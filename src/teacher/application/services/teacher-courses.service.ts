import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { CourseStats } from '../../infrastructure/entities/course-stats.entity';
import { TeacherStatsService } from './stats.service';
import { CreateTeacherCourseDto } from '../dto/create-teacher-course.dto';
import { ActivityFeedEvent } from '../../infrastructure/entities/activity-feed-event.entity';
import { Thread } from '../../infrastructure/entities/thread.entity';
import { ThreadReply } from '../../infrastructure/entities/thread-reply.entity';

export type TeacherCourseListItem = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  students_count: number;
  pending_submissions_count: number;
  unanswered_threads_count: number;
  last_activity_at: string | null;
};

@Injectable()
export class TeacherCoursesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(CourseStats)
    private readonly courseStatsRepo: Repository<CourseStats>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
    @InjectRepository(Thread)
    private readonly threadsRepo: Repository<Thread>,
    @InjectRepository(ThreadReply)
    private readonly threadRepliesRepo: Repository<ThreadReply>,
    private readonly statsService: TeacherStatsService,
  ) {}

  async listCourses(params: {
    teacherId: number;
    page: number;
    pageSize: number;
    search?: string;
    sort?: string;
  }): Promise<{ items: TeacherCourseListItem[]; total: number }> {
    const { teacherId, page, pageSize, search, sort } = params;

    const qb = this.projectsRepo
      .createQueryBuilder('p')
      .leftJoin(CourseStats, 'cs', 'cs.courseId = p.id')
      // Needed for pagination + ORDER BY on joined column (TypeORM distinctAlias)
      .addSelect('cs.lastActivityAt', 'cs_lastActivityAt')
      .where('p.owner_id = :teacherId', { teacherId });

    if (search) {
      qb.andWhere('(LOWER(p.title) LIKE :q OR LOWER(COALESCE(p.description, \'\')) LIKE :q)', {
        q: `%${search.toLowerCase()}%`,
      });
    }

    switch (sort) {
      case 'title_asc':
        qb.orderBy('p.title', 'ASC');
        break;
      case 'title_desc':
        qb.orderBy('p.title', 'DESC');
        break;
      case 'last_activity_desc':
      default:
        qb.orderBy('cs.lastActivityAt', 'DESC', 'NULLS LAST');
        qb.addOrderBy('p.updatedAt', 'DESC');
        break;
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [projects, total] = await qb.getManyAndCount();

    // Ensure stats rows exist for items in this page (lazy fill)
    for (const project of projects) {
      const code = await this.ensureCourseCode(project, teacherId);
      if (project.code !== code) {
        await this.projectsRepo.update(project.id, { code });
        project.code = code;
      }

      const hasStats = await this.courseStatsRepo.exists({ where: { courseId: project.id } });
      if (!hasStats) {
        await this.statsService.recomputeCourseStats(project.id, teacherId);
      }
    }

    const statsRows = await this.courseStatsRepo.find({
      where: projects.map((p) => ({ courseId: p.id })),
    });
    const statsByCourseId = new Map(statsRows.map((r) => [r.courseId, r]));

    const items: TeacherCourseListItem[] = projects.map((p) => {
      const s = statsByCourseId.get(p.id);
      return {
        id: p.id,
        name: p.title,
        code: p.code || this.fallbackCode(p.id),
        description: p.description ?? null,
        students_count: s?.studentsCount ?? 0,
        pending_submissions_count: s?.pendingSubmissionsCount ?? 0,
        unanswered_threads_count: s?.unansweredThreadsCount ?? 0,
        last_activity_at: s?.lastActivityAt ? s.lastActivityAt.toISOString() : null,
      };
    });

    return { items, total };
  }

  async createCourse(teacherId: number, dto: CreateTeacherCourseDto): Promise<TeacherCourseListItem> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nombre requerido');

    const code = dto.code?.trim() || this.fallbackCodeFromName(name);
    await this.assertCourseCodeAvailable(teacherId, code);

    const course = this.projectsRepo.create({
      title: name,
      description: dto.description?.trim() || undefined,
      code,
      owner: { id: teacherId } as any,
    });

    const saved = await this.projectsRepo.save(course);
    await this.statsService.recomputeCourseStats(saved.id, teacherId);
    await this.statsService.recomputeTeacherStats(teacherId);

    const stats = await this.courseStatsRepo.findOne({ where: { courseId: saved.id } });
    return {
      id: saved.id,
      name: saved.title,
      code: saved.code || code,
      description: saved.description ?? null,
      students_count: stats?.studentsCount ?? 0,
      pending_submissions_count: stats?.pendingSubmissionsCount ?? 0,
      unanswered_threads_count: stats?.unansweredThreadsCount ?? 0,
      last_activity_at: stats?.lastActivityAt ? stats.lastActivityAt.toISOString() : null,
    };
  }

  async assertTeacherOwnsCourse(teacherId: number, courseId: string): Promise<Project> {
    const course = await this.projectsRepo.findOne({
      where: { id: courseId },
      relations: ['owner'],
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (course.owner?.id !== teacherId) {
      throw new ForbiddenException('No tienes acceso a este curso');
    }
    return course;
  }

  async deleteCourse(teacherId: number, courseId: string): Promise<void> {
    await this.assertTeacherOwnsCourse(teacherId, courseId);

    await this.dataSource.transaction(async (manager) => {
      // Limpieza best-effort de tablas sin FK
      await manager.getRepository(CourseStats).delete({ courseId, teacherId });
      await manager.getRepository(ActivityFeedEvent).delete({ courseId } as any);

      const threads = await manager.getRepository(Thread).find({
        select: ['id'],
        where: { courseId, teacherId } as any,
      });
      const threadIds = threads.map((t) => t.id);
      if (threadIds.length) {
        await manager.getRepository(ThreadReply).delete({ threadId: In(threadIds) } as any);
        await manager.getRepository(Thread).delete({ id: In(threadIds) } as any);
      }

      // El Project y entidades con FK se eliminan por cascada (milestones/evidences/assignments/access).
      await manager.getRepository(Project).delete(courseId);
    });

    await this.statsService.recomputeTeacherStats(teacherId);
  }

  private fallbackCode(projectId: string): string {
    return projectId.replace(/-/g, '').slice(0, 4).toUpperCase().padEnd(4, '0');
  }

  private fallbackCodeFromName(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '0000';
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase().padEnd(4, '0');
    return (words[0][0] + words[1][0]).toUpperCase().padEnd(4, '0');
  }

  private async ensureCourseCode(project: Project, teacherId: number): Promise<string> {
    if (project.code && project.code.trim()) return project.code.trim();

    // Try to generate a 4-digit code unique per teacher
    for (let i = 0; i < 20; i++) {
      const candidate = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const exists = await this.projectsRepo
        .createQueryBuilder('p')
        .where('p.owner_id = :teacherId', { teacherId })
        .andWhere('p.code = :code', { code: candidate })
        .getCount();
      if (exists === 0) return candidate;
    }

    return this.fallbackCode(project.id);
  }

  private async assertCourseCodeAvailable(teacherId: number, code: string): Promise<void> {
    const normalized = code.trim();
    if (!normalized) return;
    const exists = await this.projectsRepo
      .createQueryBuilder('p')
      .where('p.owner_id = :teacherId', { teacherId })
      .andWhere('p.code = :code', { code: normalized })
      .getCount();
    if (exists > 0) {
      throw new BadRequestException('El código ya está en uso');
    }
  }
}

