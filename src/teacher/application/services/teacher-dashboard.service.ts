import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { TeacherStatsService } from './stats.service';
import { TeacherStats } from '../../infrastructure/entities/teacher-stats.entity';
import { Thread } from '../../infrastructure/entities/thread.entity';

type UnifiedItemType = 'submission' | 'thread' | 'alert';
type UnifiedPriority = 'high' | 'medium' | 'low';

function iso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}

@Injectable()
export class TeacherDashboardService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(Thread)
    private readonly threadsRepo: Repository<Thread>,
    @InjectRepository(TeacherStats)
    private readonly teacherStatsRepo: Repository<TeacherStats>,
    private readonly statsService: TeacherStatsService,
  ) {}

  async getDashboard(teacherId: number): Promise<{
    summary: {
      pending_submissions: number;
      unanswered_threads: number;
      overdue_items: number;
    };
    overdue_items: any[];
    today_items: any[];
  }> {
    // Ensure stats rows exist (lazy fill)
    const courseIds = await this.projectsRepo
      .createQueryBuilder('p')
      .select(['p.id'])
      .where('p.owner_id = :teacherId', { teacherId })
      .getMany()
      .then((rows) => rows.map((r) => r.id));

    for (const courseId of courseIds) {
      await this.statsService.recomputeCourseStats(courseId, teacherId);
    }
    await this.statsService.recomputeTeacherStats(teacherId);

    const stats = await this.teacherStatsRepo.findOne({ where: { teacherId } });

    const summary = {
      pending_submissions: stats?.pendingSubmissionsCount ?? 0,
      unanswered_threads: stats?.unansweredThreadsCount ?? 0,
      overdue_items: stats?.overdueCount ?? 0,
    };

    const overdueSubmissions = await this.assignmentsRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.project', 'course')
      .innerJoin('course.owner', 'teacher')
      .innerJoinAndSelect('s.student', 'student')
      .leftJoinAndSelect('s.evidence', 'evidence')
      .where('teacher.id = :teacherId', { teacherId })
      .andWhere("s.status = 'ENTREGADO'")
      .andWhere('s.deadline IS NOT NULL')
      .andWhere('s.deadline < NOW()')
      .orderBy('s.deadline', 'ASC')
      .addOrderBy('s.submittedAt', 'ASC', 'NULLS LAST')
      .take(10)
      .getMany();

    const dueTodaySubmissions = await this.assignmentsRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.project', 'course')
      .innerJoin('course.owner', 'teacher')
      .innerJoinAndSelect('s.student', 'student')
      .leftJoinAndSelect('s.evidence', 'evidence')
      .where('teacher.id = :teacherId', { teacherId })
      .andWhere("s.status = 'ENTREGADO'")
      .andWhere('s.deadline IS NOT NULL')
      .andWhere(`s.deadline >= date_trunc('day', NOW())`)
      .andWhere(`s.deadline < date_trunc('day', NOW()) + INTERVAL '1 day'`)
      .orderBy('s.deadline', 'ASC')
      .addOrderBy('s.submittedAt', 'ASC', 'NULLS LAST')
      .take(10)
      .getMany();

    const newestThreads = await this.threadsRepo
      .createQueryBuilder('t')
      .innerJoin(Project, 'course', 'course.id = t."courseId"')
      .innerJoin(User, 'author', 'author.id = t."authorId"')
      .select([
        't.id AS id',
        't."courseId" AS course_id',
        'course.title AS course_name',
        't.title AS title',
        't."createdAt" AS created_at',
        'author.name AS author_name',
        'author.email AS author_email',
      ])
      .where('t."teacherId" = :teacherId', { teacherId })
      .andWhere("t.status = 'UNANSWERED'")
      .orderBy('t."createdAt"', 'DESC')
      .take(10)
      .getRawMany<{
        id: string;
        course_id: string;
        course_name: string;
        title: string;
        created_at: Date;
        author_name: string | null;
        author_email: string;
      }>();

    const overdue_items = overdueSubmissions.map((s) =>
      this.toUnifiedSubmissionItem(s, 'high', 4),
    );

    const threadItems = newestThreads.map((row) =>
      this.toUnifiedThreadItem(
        {
          id: row.id,
          courseId: row.course_id,
          title: row.title,
          createdAt: row.created_at,
        } as any,
        row.course_name || '',
        (row.author_name || row.author_email || '').trim(),
        'medium',
        2,
      ),
    );

    const todaySubmissionItems = dueTodaySubmissions.map((s) =>
      this.toUnifiedSubmissionItem(s, 'high', 3),
    );

    const today_items = [...todaySubmissionItems, ...threadItems]
      .sort((a, b) => (b._priorityScore || 0) - (a._priorityScore || 0))
      .slice(0, 20)
      .map(({ _priorityScore, ...rest }) => rest);

    return {
      summary,
      overdue_items: overdue_items.map(({ _priorityScore, ...rest }) => rest),
      today_items,
    };
  }

  private toUnifiedSubmissionItem(
    submission: Assignment,
    priority: UnifiedPriority,
    priorityScore: number,
  ) {
    const title = submission.evidence?.title || 'Entrega';
    return {
      type: 'submission' as UnifiedItemType,
      id: submission.id,
      course_id: submission.projectId,
      course_name: (submission.project as any)?.title || '',
      student_name: (submission.student as any)?.name || '',
      title,
      status: 'pending',
      priority,
      created_at: iso(submission.createdAt),
      due_at: iso(submission.deadline),
      deep_link: `/entregas?open=${submission.id}`,
      _priorityScore: priorityScore,
    };
  }

  private toUnifiedThreadItem(
    thread: Thread,
    courseName: string,
    authorName: string,
    priority: UnifiedPriority,
    priorityScore: number,
  ) {
    return {
      type: 'thread' as UnifiedItemType,
      id: thread.id,
      course_id: thread.courseId,
      course_name: courseName,
      student_name: authorName,
      title: thread.title,
      status: 'unanswered',
      priority,
      created_at: iso(thread.createdAt),
      due_at: null,
      deep_link: `/inicio?thread=${thread.id}`,
      _priorityScore: priorityScore,
    };
  }
}

