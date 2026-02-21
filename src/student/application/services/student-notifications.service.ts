import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RefreshToken } from '../../../auth/infrastructure/entities/refresh-token.entity';
import { AssignmentStatus } from '../../../assignments/domain/assignment-status';
import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import {
  AccessStatus,
  ProjectAccess,
} from '../../../project-access/infrastructure/entities/project-access.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { ActivityFeedEvent } from '../../../teacher/infrastructure/entities/activity-feed-event.entity';

@Injectable()
export class StudentNotificationsService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepo: Repository<RefreshToken>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(ProjectAccess)
    private readonly accessRepo: Repository<ProjectAccess>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
  ) {}

  async listNotifications(params: {
    studentId: number;
    page: number;
    pageSize: number;
  }): Promise<{
    items: Array<{
      id: string;
      type: 'login' | 'teacher_upload' | 'delivery_success';
      title: string;
      course_id: string | null;
      course_name: string | null;
      actor_name: string | null;
      created_at: string;
      deep_link: string | null;
    }>;
    total: number;
  }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 10));
    const limit = Math.min(500, page * pageSize);

    const courseIdsRows = await this.accessRepo
      .createQueryBuilder('a')
      .select('a.project_id', 'course_id')
      .where('a.user_id = :studentId', { studentId: params.studentId })
      .andWhere('a.status = :status', { status: AccessStatus.APPROVED })
      .getRawMany<{ course_id: string }>();

    const courseIds = courseIdsRows.map((r) => r.course_id).filter(Boolean);
    const deliveredMilestoneIds = courseIds.length
      ? (
          await this.assignmentsRepo
            .createQueryBuilder('a')
            .select('DISTINCT a.milestoneId', 'milestone_id')
            .where('a.studentId = :studentId', { studentId: params.studentId })
            .andWhere('a.projectId IN (:...courseIds)', { courseIds })
            .andWhere('a.milestoneId IS NOT NULL')
            .andWhere('a.status IN (:...deliveredStates)', {
              deliveredStates: [AssignmentStatus.ENTREGADO, AssignmentStatus.REVISADO],
            })
            .getRawMany<{ milestone_id: string | null }>()
        )
          .map((r) => r.milestone_id)
          .filter((id): id is string => !!id)
      : [];

    const [uploadsTotal, deliveriesTotal, loginsTotal] = await Promise.all([
      (async () => {
        if (!courseIds.length) return 0;
        const qb = this.feedRepo
          .createQueryBuilder('e')
          .where('e.type = :type', { type: 'announcement_created' })
          .andWhere('e.courseId IN (:...courseIds)', { courseIds });

        if (deliveredMilestoneIds.length) {
          qb.andWhere(
            `(e.metadata->>'milestoneId' IS NULL OR e.metadata->>'milestoneId' NOT IN (:...deliveredMilestoneIds))`,
            { deliveredMilestoneIds },
          );
        }

        return qb.getCount();
      })(),
      courseIds.length
        ? this.feedRepo
            .createQueryBuilder('e')
            .where('e.type = :type', { type: 'submission_created' })
            .andWhere('e.actorType = :actorType', { actorType: 'student' })
            .andWhere('e.actorId = :studentId', { studentId: params.studentId })
            .andWhere('e.courseId IN (:...courseIds)', { courseIds })
            .getCount()
        : Promise.resolve(0),
      this.refreshTokensRepo.count({ where: { userId: params.studentId } }),
    ]);

    const [uploads, deliveries, logins] = await Promise.all([
      (async () => {
        if (!courseIds.length) return [];
        const qb = this.feedRepo
          .createQueryBuilder('e')
          .innerJoin(Project, 'c', 'c.id = e.courseId')
          .select([
            'e.id AS id',
            'e.type AS type',
            'e.actorName AS actor_name',
            'e.courseId AS course_id',
            'c.title AS course_name',
            'e.title AS title',
            'e.createdAt AS created_at',
          ])
          .where('e.type = :type', { type: 'announcement_created' })
          .andWhere('e.courseId IN (:...courseIds)', { courseIds });

        if (deliveredMilestoneIds.length) {
          qb.andWhere(
            `(e.metadata->>'milestoneId' IS NULL OR e.metadata->>'milestoneId' NOT IN (:...deliveredMilestoneIds))`,
            { deliveredMilestoneIds },
          );
        }

        return qb
          .orderBy('e.createdAt', 'DESC')
          .take(limit)
          .getRawMany<{
            id: string;
            actor_name: string | null;
            course_id: string;
            course_name: string | null;
            title: string | null;
            created_at: Date | string;
          }>();
      })(),
      courseIds.length
        ? this.feedRepo
            .createQueryBuilder('e')
            .innerJoin(Project, 'c', 'c.id = e.courseId')
            .select([
              'e.id AS id',
              'e.type AS type',
              'e.actorName AS actor_name',
              'e.courseId AS course_id',
              'c.title AS course_name',
              'e.title AS title',
              'e.createdAt AS created_at',
            ])
            .where('e.type = :type', { type: 'submission_created' })
            .andWhere('e.actorType = :actorType', { actorType: 'student' })
            .andWhere('e.actorId = :studentId', { studentId: params.studentId })
            .andWhere('e.courseId IN (:...courseIds)', { courseIds })
            .orderBy('e.createdAt', 'DESC')
            .take(limit)
            .getRawMany<{
              id: string;
              actor_name: string | null;
              course_id: string;
              course_name: string | null;
              title: string | null;
              created_at: Date | string;
            }>()
        : Promise.resolve([]),
      this.refreshTokensRepo.find({
        where: { userId: params.studentId },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
    ]);

    const mappedUploads = uploads.map((e) => ({
      id: e.id,
      type: 'teacher_upload' as const,
      title: e.title || 'Nueva actividad publicada',
      course_id: e.course_id,
      course_name: e.course_name || null,
      actor_name: e.actor_name || null,
      created_at: new Date(e.created_at as any).toISOString(),
      deep_link: e.course_id ? `/actividades/${e.course_id}` : null,
    }));

    const mappedDeliveries = deliveries.map((e) => {
      const rawTitle = (e.title || '').trim();
      const suffix = rawTitle.includes(':')
        ? rawTitle.split(':').slice(1).join(':').trim()
        : '';
      const activityName = suffix || rawTitle || 'Actividad';

      return {
        id: e.id,
        type: 'delivery_success' as const,
        title: `Entrega exitosa: ${activityName}`,
        course_id: e.course_id,
        course_name: e.course_name || null,
        actor_name: e.actor_name || null,
        created_at: new Date(e.created_at as any).toISOString(),
        deep_link: e.course_id ? `/entregas/${e.course_id}` : '/entregas',
      };
    });

    const mappedLogins = logins.map((t) => ({
      id: `login_${t.id}`,
      type: 'login' as const,
      title: 'Inicio de sesión',
      course_id: null,
      course_name: null,
      actor_name: null,
      created_at: t.createdAt.toISOString(),
      deep_link: null,
    }));

    const merged = [...mappedUploads, ...mappedDeliveries, ...mappedLogins].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const start = (page - 1) * pageSize;
    const items = merged.slice(start, start + pageSize);

    return {
      items,
      total: uploadsTotal + deliveriesTotal + loginsTotal,
    };
  }
}
