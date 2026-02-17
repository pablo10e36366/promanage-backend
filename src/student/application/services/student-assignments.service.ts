import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { AssignmentStatus } from '../../../assignments/domain/assignment-status';
import {
  AccessStatus,
  ProjectAccess,
} from '../../../project-access/infrastructure/entities/project-access.entity';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';

type ListStudentAssignmentsArgs = {
  studentId: number;
  page: number;
  pageSize: number;
  courseId?: string;
  status?: AssignmentStatus;
  q?: string;
  sort?: string;
};

@Injectable()
export class StudentAssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
  ) {}

  private async ensureAssignmentsExist(args: {
    studentId: number;
    courseId?: string;
  }): Promise<void> {
    const courseRows: Array<{ project_id: string }> = await this.assignmentsRepo.manager.query(
      `
        SELECT DISTINCT pa.project_id
        FROM project_access pa
        WHERE pa.user_id = $1
          AND pa.status = $2
          ${args.courseId ? 'AND pa.project_id = $3' : ''}
      `,
      args.courseId
        ? [args.studentId, AccessStatus.APPROVED, args.courseId]
        : [args.studentId, AccessStatus.APPROVED],
    );

    const courseIds = courseRows
      .map((r) => r.project_id)
      .filter((id) => typeof id === 'string' && id.length > 0);

    if (!courseIds.length) return;

    const milestoneRows: Array<{ id: string; projectId: string; dueDate: string | null }> =
      await this.assignmentsRepo.manager.query(
        `
          SELECT m.id, m."projectId", m."dueDate"
          FROM milestones m
          WHERE m."projectId" = ANY($1::uuid[])
        `,
        [courseIds],
      );

    const milestoneIds = milestoneRows
      .map((m) => m.id)
      .filter((id) => typeof id === 'string' && id.length > 0);

    if (!milestoneIds.length) return;

    const existingRows: Array<{ milestoneId: string }> = await this.assignmentsRepo.manager.query(
      `
        SELECT a."milestoneId" as "milestoneId"
        FROM assignments a
        WHERE a."studentId" = $1
          AND a."milestoneId" = ANY($2::uuid[])
      `,
      [args.studentId, milestoneIds],
    );

    const existingMilestoneIds = new Set(
      existingRows
        .map((r) => r.milestoneId)
        .filter((id) => typeof id === 'string' && id.length > 0),
    );

    const toCreate: Array<Partial<Assignment>> = [];
    for (const milestone of milestoneRows) {
      if (!milestone?.id || existingMilestoneIds.has(milestone.id)) continue;
      toCreate.push({
        projectId: milestone.projectId,
        milestoneId: milestone.id,
        studentId: args.studentId,
        evidenceId: null,
        status: AssignmentStatus.PENDIENTE,
        deadline: milestone.dueDate ? new Date(milestone.dueDate) : null,
        isLate: false,
        feedback: null,
        submittedAt: null,
      });
    }

    if (!toCreate.length) return;

    await this.assignmentsRepo.save(toCreate);
  }

  async list(args: ListStudentAssignmentsArgs): Promise<{
    items: any[];
    total: number;
    page: number;
    page_size: number;
  }> {
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.max(1, Math.min(100, args.pageSize || 10));
    const q = (args.q || '').trim();

    await this.ensureAssignmentsExist({ studentId: args.studentId, courseId: args.courseId });

    const qb = this.assignmentsRepo
      .createQueryBuilder('a')
      .innerJoin(
        ProjectAccess,
        'access',
        'access.project_id = a.projectId AND access.user_id = :studentId AND access.status = :approved',
        { studentId: args.studentId, approved: AccessStatus.APPROVED },
      )
      .leftJoinAndSelect('a.project', 'course')
      .leftJoinAndSelect('a.milestone', 'milestone')
      .leftJoinAndSelect('a.evidence', 'evidence')
      .leftJoin(
        Evidence,
        'activity_folder',
        `activity_folder."isFolder" = true
          AND activity_folder."parentId" IS NULL
          AND activity_folder."milestoneId" = a."milestoneId"`,
      )
      .addSelect('activity_folder.id', 'activity_folder_id')
      .where('a.studentId = :studentId', { studentId: args.studentId });

    if (args.courseId) {
      qb.andWhere('a.projectId = :courseId', { courseId: args.courseId });
    }

    if (args.status) {
      if (args.status === AssignmentStatus.PENDIENTE) {
        // Para el estudiante, "cambios solicitados" debe volver a verse como pendiente.
        qb.andWhere(
          `(a.status = :pending OR (a.status = :reviewed AND a."reviewOutcome" = :changes))`,
          {
            pending: AssignmentStatus.PENDIENTE,
            reviewed: AssignmentStatus.REVISADO,
            changes: 'CHANGES_REQUESTED',
          },
        );
      } else if (args.status === AssignmentStatus.REVISADO) {
        // "Revisadas" excluye las que requieren nueva entrega.
        qb.andWhere(
          `(a.status = :reviewed AND (a."reviewOutcome" IS NULL OR a."reviewOutcome" != :changes))`,
          {
            reviewed: AssignmentStatus.REVISADO,
            changes: 'CHANGES_REQUESTED',
          },
        );
      } else {
        qb.andWhere('a.status = :status', { status: args.status });
      }
    }

    if (q) {
      qb.andWhere(
        '(course.title ILIKE :q OR milestone.title ILIKE :q OR evidence.title ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    // Sorting
    switch (args.sort) {
      case 'created_at_asc':
        qb.orderBy('a.createdAt', 'ASC');
        break;
      case 'deadline_asc':
        qb.orderBy('a.deadline', 'ASC', 'NULLS LAST').addOrderBy('a.createdAt', 'DESC');
        break;
      case 'deadline_desc':
        qb.orderBy('a.deadline', 'DESC', 'NULLS LAST').addOrderBy('a.createdAt', 'DESC');
        break;
      case 'created_at_desc':
      default:
        qb.orderBy('a.createdAt', 'DESC');
    }

    const total = await qb.getCount();

    const rows = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawAndEntities();

    const items = rows.entities.map((a, index) => {
      const reviewOutcome = a.reviewOutcome ?? null;
      const status =
        a.status === AssignmentStatus.REVISADO && reviewOutcome === 'CHANGES_REQUESTED'
          ? AssignmentStatus.PENDIENTE
          : a.status;

      return {
      id: a.id,
      course_id: a.projectId,
      course_name: a.project?.title ?? null,
      status,
      created_at: a.createdAt ? a.createdAt.toISOString() : null,
      submitted_at: a.submittedAt ? a.submittedAt.toISOString() : null,
      due_at: a.deadline ? a.deadline.toISOString() : null,
      is_late: !!a.isLate,
      feedback: a.feedback ?? null,
      review_outcome: reviewOutcome,
      milestone_id: a.milestoneId,
      milestone_title: a.milestone?.title ?? null,
      activity_folder_id: rows.raw[index]?.activity_folder_id ?? null,
      evidence_id: a.evidenceId,
      evidence_title: a.evidence?.title ?? null,
      };
    });

    return { items, total, page, page_size: pageSize };
  }
}
