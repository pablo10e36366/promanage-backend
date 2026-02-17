import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { RefreshToken } from '../../../auth/infrastructure/entities/refresh-token.entity';
import {
  ProjectAccess,
  AccessStatus,
} from '../../../project-access/infrastructure/entities/project-access.entity';
import { CourseStats } from '../../infrastructure/entities/course-stats.entity';
import { TeacherStats } from '../../infrastructure/entities/teacher-stats.entity';
import { TeacherStatsService } from './stats.service';
import { ActivityFeedEvent } from '../../infrastructure/entities/activity-feed-event.entity';

@Injectable()
export class TeacherNotificationsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ProjectAccess)
    private readonly accessRepo: Repository<ProjectAccess>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepo: Repository<RefreshToken>,
    @InjectRepository(CourseStats)
    private readonly courseStatsRepo: Repository<CourseStats>,
    @InjectRepository(TeacherStats)
    private readonly teacherStatsRepo: Repository<TeacherStats>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
    private readonly statsService: TeacherStatsService,
  ) {}

  async getBadges(teacherId: number): Promise<{
    submissions_pending: number;
    threads_unanswered: number;
    alerts: number;
  }> {
    const courses = await this.projectsRepo
      .createQueryBuilder('p')
      .select(['p.id'])
      .where('p.owner_id = :teacherId', { teacherId })
      .getMany();

    for (const c of courses) {
      const hasStats = await this.courseStatsRepo.exists({ where: { courseId: c.id } });
      if (!hasStats) {
        await this.statsService.recomputeCourseStats(c.id, teacherId);
      }
    }

    await this.statsService.recomputeTeacherStats(teacherId);
    const stats = await this.teacherStatsRepo.findOne({ where: { teacherId } });

    return {
      submissions_pending: stats?.pendingSubmissionsCount ?? 0,
      threads_unanswered: stats?.unansweredThreadsCount ?? 0,
      alerts: stats?.overdueCount ?? 0,
    };
  }

  async listNotifications(params: {
    teacherId: number;
    page: number;
    pageSize: number;
  }): Promise<{
    items: Array<{
      id: string;
      type: 'login' | 'student_submission' | 'join_request';
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

    const [submissionsTotal, joinRequestsTotalRows, loginsTotal] = await Promise.all([
      this.feedRepo.count({
        where: { teacherId: params.teacherId, type: 'submission_created' as any } as any,
      }),
      this.accessRepo.query(
        `
          SELECT COUNT(*)::int AS cnt
          FROM project_access a
          JOIN projects c ON c.id = a.project_id
          WHERE c.owner_id = $1 AND a.status = $2
        `,
        [params.teacherId, AccessStatus.PENDING],
      ) as Promise<Array<{ cnt: number }>>,
      this.refreshTokensRepo.count({ where: { userId: params.teacherId } }),
    ]);

    const joinRequestsTotal = Number(joinRequestsTotalRows?.[0]?.cnt ?? 0) || 0;

    const [events, joinRequests, logins] = await Promise.all([
      this.feedRepo
        .createQueryBuilder('e')
        .innerJoin(Project, 'c', 'c.id = e.courseId')
        .select([
          'e.id AS id',
          'e.type AS type',
          'e.actorName AS actor_name',
          'e.entityId AS entity_id',
          'e.courseId AS course_id',
          'c.title AS course_name',
          'e.title AS title',
          'e.createdAt AS created_at',
        ])
        .where('e.teacherId = :teacherId', { teacherId: params.teacherId })
        .andWhere('e.type = :type', { type: 'submission_created' })
        .orderBy('e.createdAt', 'DESC')
        .take(limit)
        .getRawMany<{
          id: string;
          actor_name: string | null;
          entity_id: string | null;
          course_id: string;
          course_name: string;
          title: string | null;
          created_at: Date | string;
        }>(),
      this.accessRepo.query(
        `
          SELECT
            a.id AS id,
            a.requested_at AS created_at,
            c.id AS course_id,
            c.title AS course_name,
            u.name AS student_name,
            u.email AS student_email
          FROM project_access a
          JOIN projects c ON c.id = a.project_id
          JOIN users u ON u.id = a.user_id
          WHERE c.owner_id = $1 AND a.status = $2
          ORDER BY a.requested_at DESC
          LIMIT $3
        `,
        [params.teacherId, AccessStatus.PENDING, limit],
      ) as Promise<
        Array<{
          id: string;
          created_at: Date | string;
          course_id: string;
          course_name: string | null;
          student_name: string | null;
          student_email: string | null;
        }>
      >,
      this.refreshTokensRepo.find({
        where: { userId: params.teacherId },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
    ]);

    const mappedEvents = events.map((e) => ({
      id: e.id,
      type: 'student_submission' as const,
      title: e.title || 'Entrega recibida',
      course_id: e.course_id,
      course_name: e.course_name || null,
      actor_name: e.actor_name || null,
      created_at: new Date(e.created_at as any).toISOString(),
      deep_link: e.entity_id ? `/entregas?open=${e.entity_id}` : '/entregas',
    }));

    const mappedJoinRequests = joinRequests.map((r) => ({
      id: r.id,
      type: 'join_request' as const,
      title: 'Solicitud para unirse al curso',
      course_id: r.course_id,
      course_name: r.course_name || null,
      actor_name: r.student_name || r.student_email || null,
      created_at: new Date(r.created_at as any).toISOString(),
      deep_link: r.course_id ? `/projects/${r.course_id}` : '/projects',
    }));

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

    const merged = [...mappedEvents, ...mappedJoinRequests, ...mappedLogins].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const start = (page - 1) * pageSize;
    const items = merged.slice(start, start + pageSize);

    return {
      items,
      total: submissionsTotal + joinRequestsTotal + loginsTotal,
    };
  }
}
