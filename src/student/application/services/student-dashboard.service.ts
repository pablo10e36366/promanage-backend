import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { AssignmentStatus } from '../../../assignments/domain/assignment-status';
import { Milestone, MilestoneStatus } from '../../../milestones/infrastructure/entities/milestone.entity';
import {
  AccessStatus,
  ProjectAccess,
} from '../../../project-access/infrastructure/entities/project-access.entity';

type StudentTaskItem = {
  course_id: string;
  course_name: string | null;
  milestone_id: string;
  milestone_title: string;
  due_at: string | null;
  can_submit_until: string | null;
  status: AssignmentStatus;
};

@Injectable()
export class StudentDashboardService {
  // MVP rule for "aÃºn pueden ser entregadas":
  // allow late submissions up to N days after due date (until the platform has per-activity settings).
  private readonly lateGraceDays = 7;

  constructor(
    @InjectRepository(ProjectAccess)
    private readonly accessRepo: Repository<ProjectAccess>,
    @InjectRepository(Milestone)
    private readonly milestonesRepo: Repository<Milestone>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
  ) {}

  async getDashboard(args: { studentId: number }): Promise<{
    pending_total: number;
    overdue_total: number;
    pending_items: StudentTaskItem[];
    overdue_items: StudentTaskItem[];
  }> {
    const now = Date.now();
    const minDueDate = new Date(now - this.lateGraceDays * 24 * 60 * 60 * 1000);

    const access = await this.accessRepo.find({
      where: {
        user: { id: args.studentId } as any,
        status: AccessStatus.APPROVED,
      } as any,
    });

    const courseIds = Array.from(
      new Set(access.map((a) => a.project?.id).filter(Boolean) as string[]),
    );

    if (!courseIds.length) {
      return {
        pending_total: 0,
        overdue_total: 0,
        pending_items: [],
        overdue_items: [],
      };
    }

    const milestones = await this.milestonesRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.project', 'course')
      .where('course.id IN (:...courseIds)', { courseIds })
      .andWhere('m.status != :completed', { completed: MilestoneStatus.COMPLETED })
      // Exclude activities that are already "not deliverable" (expired beyond grace window)
      .andWhere('(m.dueDate IS NULL OR m.dueDate >= :minDueDate)', { minDueDate })
      .orderBy('m.dueDate', 'ASC', 'NULLS LAST')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();

    if (!milestones.length) {
      return {
        pending_total: 0,
        overdue_total: 0,
        pending_items: [],
        overdue_items: [],
      };
    }

    const milestoneIds = milestones.map((m) => m.id);

    const assignments = await this.assignmentsRepo.find({
      where: {
        studentId: args.studentId,
        milestoneId: In(milestoneIds) as any,
      } as any,
      relations: ['evidence'],
    });

    const latestByMilestone = new Map<string, Assignment>();
    for (const a of assignments) {
      if (!a.milestoneId) continue;
      const existing = latestByMilestone.get(a.milestoneId);
      const aTime = (a.submittedAt || a.createdAt)?.getTime?.() ?? 0;
      const eTime = (existing?.submittedAt || existing?.createdAt)?.getTime?.() ?? 0;
      if (!existing || aTime >= eTime) latestByMilestone.set(a.milestoneId, a);
    }

    const pending_items: StudentTaskItem[] = [];
    const overdue_items: StudentTaskItem[] = [];

    for (const m of milestones) {
      const a = latestByMilestone.get(m.id);

      // If student already delivered (or got reviewed), it is not a pending task.
      // Exception: si el docente solicitÃƒÂ³ cambios, vuelve a ser pendiente para el estudiante.
      if (
        a &&
        (a.status === AssignmentStatus.ENTREGADO ||
          (a.status === AssignmentStatus.REVISADO &&
            a.reviewOutcome !== 'CHANGES_REQUESTED'))
      ) {
        continue;
      }

      const dueAt = m.dueDate ? m.dueDate.getTime() : null;
      const canSubmitUntil =
        m.dueDate != null
          ? new Date(m.dueDate.getTime() + this.lateGraceDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const item: StudentTaskItem = {
        course_id: (m as any).project?.id,
        course_name: (m as any).project?.title ?? null,
        milestone_id: m.id,
        milestone_title: m.title,
        due_at: m.dueDate ? m.dueDate.toISOString() : null,
        can_submit_until: canSubmitUntil,
        status: AssignmentStatus.PENDIENTE,
      };

      if (dueAt != null && dueAt < now) {
        overdue_items.push(item);
      } else {
        pending_items.push(item);
      }
    }

    // Ensure stable ordering: soonest deadlines first (NULLS LAST)
    const byDueAsc = (x: StudentTaskItem, y: StudentTaskItem) => {
      const dx = x.due_at ? new Date(x.due_at).getTime() : Number.POSITIVE_INFINITY;
      const dy = y.due_at ? new Date(y.due_at).getTime() : Number.POSITIVE_INFINITY;
      return dx - dy;
    };
    pending_items.sort(byDueAsc);
    overdue_items.sort(byDueAsc);

    return {
      pending_total: pending_items.length,
      overdue_total: overdue_items.length,
      pending_items,
      overdue_items,
    };
  }
}

