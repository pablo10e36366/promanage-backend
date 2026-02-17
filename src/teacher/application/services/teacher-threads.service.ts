import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { ActivityFeedEvent } from '../../infrastructure/entities/activity-feed-event.entity';
import { CourseStats } from '../../infrastructure/entities/course-stats.entity';
import { TeacherStats } from '../../infrastructure/entities/teacher-stats.entity';
import { ThreadReply } from '../../infrastructure/entities/thread-reply.entity';
import { Thread } from '../../infrastructure/entities/thread.entity';
import { TeacherThreadsQueryDto } from '../dto/teacher-threads.query.dto';

function iso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}

@Injectable()
export class TeacherThreadsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Thread)
    private readonly threadsRepo: Repository<Thread>,
    @InjectRepository(ThreadReply)
    private readonly repliesRepo: Repository<ThreadReply>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
    @InjectRepository(CourseStats)
    private readonly courseStatsRepo: Repository<CourseStats>,
    @InjectRepository(TeacherStats)
    private readonly teacherStatsRepo: Repository<TeacherStats>,
  ) {}

  async list(teacherId: number, query: TeacherThreadsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;
    const status = query.status ?? 'unanswered';
    const sort = query.sort ?? 'created_at_desc';

    const qb = this.threadsRepo
      .createQueryBuilder('t')
      .where('t.teacherId = :teacherId', { teacherId });

    if (query.course_id) qb.andWhere('t.courseId = :courseId', { courseId: query.course_id });

    if (query.q) {
      const q = `%${query.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(t.title) LIKE :q OR LOWER(t.message) LIKE :q)', { q });
    }

    if (status === 'unanswered') qb.andWhere('t.status = :st', { st: 'UNANSWERED' });
    if (status === 'answered') qb.andWhere('t.status = :st', { st: 'ANSWERED' });

    if (sort === 'created_at_asc') qb.orderBy('t.createdAt', 'ASC');
    else qb.orderBy('t.createdAt', 'DESC');

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [threads, total] = await qb.getManyAndCount();

    const courseIds = Array.from(new Set(threads.map((t) => t.courseId)));
    const authorIds = Array.from(new Set(threads.map((t) => t.authorId)));

    const [courses, authors] = await Promise.all([
      courseIds.length
        ? this.projectsRepo
            .createQueryBuilder('p')
            .select(['p.id', 'p.title'])
            .where('p.id IN (:...ids)', { ids: courseIds })
            .getMany()
        : Promise.resolve([]),
      authorIds.length
        ? this.usersRepo
            .createQueryBuilder('u')
            .select(['u.id', 'u.name', 'u.email'])
            .where('u.id IN (:...ids)', { ids: authorIds })
            .getMany()
        : Promise.resolve([]),
    ]);

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const authorById = new Map(authors.map((a) => [a.id, a]));

    const items = threads.map((t) => {
      const c = courseById.get(t.courseId);
      const a = authorById.get(t.authorId);
      const authorName = (a?.name || a?.email || '').trim();
      return {
        id: t.id,
        course_id: t.courseId,
        course_name: c?.title || '',
        author_id: t.authorId,
        author_name: authorName,
        title: t.title,
        status: t.status === 'ANSWERED' ? 'answered' : 'unanswered',
        created_at: iso(t.createdAt),
        deep_link: `/inicio?thread=${t.id}`,
      };
    });

    return { items, page, page_size: pageSize, total };
  }

  async getOne(teacherId: number, threadId: string) {
    const thread = await this.threadsRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Duda no encontrada');
    if (thread.teacherId !== teacherId) throw new ForbiddenException('No tienes acceso a esta duda');

    const [course, author, replies] = await Promise.all([
      this.projectsRepo.findOne({ where: { id: thread.courseId } }),
      this.usersRepo.findOne({ where: { id: thread.authorId } }),
      this.repliesRepo.find({
        where: { threadId: thread.id },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const replyAuthorIds = Array.from(new Set(replies.map((r) => r.authorId)));
    const replyAuthors = replyAuthorIds.length
      ? await this.usersRepo
          .createQueryBuilder('u')
          .select(['u.id', 'u.name', 'u.email'])
          .where('u.id IN (:...ids)', { ids: replyAuthorIds })
          .getMany()
      : [];
    const replyAuthorById = new Map(replyAuthors.map((u) => [u.id, u]));

    return {
      id: thread.id,
      course_id: thread.courseId,
      course_name: course?.title || '',
      author_id: thread.authorId,
      author_name: (author?.name || author?.email || '').trim(),
      title: thread.title,
      message: thread.message,
      status: thread.status === 'ANSWERED' ? 'answered' : 'unanswered',
      created_at: iso(thread.createdAt),
      replies: replies.map((r) => {
        const u = replyAuthorById.get(r.authorId);
        return {
          id: r.id,
          author_id: r.authorId,
          author_name: (u?.name || u?.email || '').trim(),
          message: r.message,
          created_at: iso(r.createdAt),
        };
      }),
    };
  }

  async reply(teacherId: number, threadId: string, message: string) {
    const teacher = await this.usersRepo.findOne({ where: { id: teacherId } });
    if (!teacher) throw new ForbiddenException('Docente no encontrado');

    const trimmed = message.trim();
    if (!trimmed) throw new BadRequestException('Mensaje requerido');

    const now = new Date();

    await this.dataSource.transaction(async (manager) => {
      const thread = await manager.getRepository(Thread).findOne({ where: { id: threadId } });
      if (!thread) throw new NotFoundException('Duda no encontrada');
      if (thread.teacherId !== teacherId) throw new ForbiddenException('No tienes acceso a esta duda');

      await manager
        .createQueryBuilder()
        .insert()
        .into(CourseStats)
        .values({ courseId: thread.courseId, teacherId } as any)
        .orIgnore()
        .execute();
      await manager
        .createQueryBuilder()
        .insert()
        .into(TeacherStats)
        .values({ teacherId } as any)
        .orIgnore()
        .execute();

      await manager.getRepository(ThreadReply).insert({
        threadId: thread.id,
        authorId: teacherId,
        message: trimmed,
      } as any);

      const wasUnanswered = thread.status === 'UNANSWERED';
      if (wasUnanswered) {
        await manager.getRepository(Thread).update({ id: thread.id }, { status: 'ANSWERED' as any, updatedAt: now as any } as any);

        await manager
          .createQueryBuilder()
          .update(CourseStats)
          .set({
            unansweredThreadsCount: () => `GREATEST("unansweredThreadsCount" - 1, 0)`,
            lastActivityAt: () => 'NOW()',
          })
          .where('"courseId" = :courseId', { courseId: thread.courseId })
          .execute();

        await manager
          .createQueryBuilder()
          .update(TeacherStats)
          .set({
            unansweredThreadsCount: () => `GREATEST("unansweredThreadsCount" - 1, 0)`,
            updatedAt: () => 'NOW()',
          })
          .where('"teacherId" = :teacherId', { teacherId })
          .execute();
      }

      await manager.getRepository(ActivityFeedEvent).insert({
        teacherId,
        courseId: thread.courseId,
        type: 'reply_created',
        actorType: 'teacher',
        actorId: teacherId,
        actorName: teacher.name || teacher.email,
        entityId: thread.id,
        title: 'Respuesta del docente',
        metadata: { threadId: thread.id },
      } as any);
    });

    return this.getOne(teacherId, threadId);
  }

  async updateStatus(teacherId: number, threadId: string, status: 'answered' | 'unanswered') {
    const normalized = status === 'answered' ? 'ANSWERED' : 'UNANSWERED';

    await this.dataSource.transaction(async (manager) => {
      const thread = await manager.getRepository(Thread).findOne({ where: { id: threadId } });
      if (!thread) throw new NotFoundException('Duda no encontrada');
      if (thread.teacherId !== teacherId) throw new ForbiddenException('No tienes acceso a esta duda');

      if (thread.status === normalized) return;

      const before = thread.status;

      await manager
        .createQueryBuilder()
        .insert()
        .into(CourseStats)
        .values({ courseId: thread.courseId, teacherId } as any)
        .orIgnore()
        .execute();
      await manager
        .createQueryBuilder()
        .insert()
        .into(TeacherStats)
        .values({ teacherId } as any)
        .orIgnore()
        .execute();

      await manager.getRepository(Thread).update({ id: threadId }, { status: normalized as any } as any);

      // Keep stats consistent
      if (before === 'UNANSWERED' && normalized === 'ANSWERED') {
        await manager
          .createQueryBuilder()
          .update(CourseStats)
          .set({ unansweredThreadsCount: () => `GREATEST("unansweredThreadsCount" - 1, 0)` })
          .where('"courseId" = :courseId', { courseId: thread.courseId })
          .execute();
        await manager
          .createQueryBuilder()
          .update(TeacherStats)
          .set({ unansweredThreadsCount: () => `GREATEST("unansweredThreadsCount" - 1, 0)` })
          .where('"teacherId" = :teacherId', { teacherId })
          .execute();
      } else if (before === 'ANSWERED' && normalized === 'UNANSWERED') {
        await manager
          .createQueryBuilder()
          .update(CourseStats)
          .set({ unansweredThreadsCount: () => `"unansweredThreadsCount" + 1` })
          .where('"courseId" = :courseId', { courseId: thread.courseId })
          .execute();
        await manager
          .createQueryBuilder()
          .update(TeacherStats)
          .set({ unansweredThreadsCount: () => `"unansweredThreadsCount" + 1` })
          .where('"teacherId" = :teacherId', { teacherId })
          .execute();
      }
    });

    return this.getOne(teacherId, threadId);
  }
}


