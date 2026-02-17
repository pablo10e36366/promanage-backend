import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { ProjectAccess, AccessStatus } from '../../../project-access/infrastructure/entities/project-access.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { ActivityFeedEvent } from '../../infrastructure/entities/activity-feed-event.entity';
import { CourseStats } from '../../infrastructure/entities/course-stats.entity';
import { TeacherStats } from '../../infrastructure/entities/teacher-stats.entity';
import { Thread } from '../../infrastructure/entities/thread.entity';

@Injectable()
export class TeacherStatsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ProjectAccess)
    private readonly accessRepo: Repository<ProjectAccess>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(Thread)
    private readonly threadsRepo: Repository<Thread>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
    @InjectRepository(CourseStats)
    private readonly courseStatsRepo: Repository<CourseStats>,
    @InjectRepository(TeacherStats)
    private readonly teacherStatsRepo: Repository<TeacherStats>,
  ) {}

  async ensureCourseStats(courseId: string, teacherId: number): Promise<CourseStats> {
    const existing = await this.courseStatsRepo.findOne({ where: { courseId } });
    if (existing) return existing;
    const row = this.courseStatsRepo.create({ courseId, teacherId });
    return this.courseStatsRepo.save(row);
  }

  async recomputeCourseStats(courseId: string, teacherId?: number): Promise<CourseStats> {
    const project = await this.projectsRepo.findOne({
      where: { id: courseId },
      relations: ['owner'],
    });
    if (!project) throw new NotFoundException('Curso no encontrado');

    const resolvedTeacherId = teacherId ?? project.owner?.id;
    if (!resolvedTeacherId) throw new NotFoundException('Curso sin docente');

    await this.ensureCourseStats(courseId, resolvedTeacherId);

    // "students_count" for teacher UX: count approved enrollments excluding the teacher/owner.
    const studentsCount = await this.accessRepo
      .createQueryBuilder('pa')
      .innerJoin('pa.project', 'project')
      .innerJoin('pa.user', 'user')
      .where('project.id = :courseId', { courseId })
      .andWhere('pa.status = :approved', { approved: AccessStatus.APPROVED })
      .andWhere('user.id <> :teacherId', { teacherId: resolvedTeacherId })
      .getCount();

    const pendingSubmissionsCount = await this.assignmentsRepo
      .createQueryBuilder('s')
      .where('s.projectId = :courseId', { courseId })
      .andWhere('s.status = :status', { status: 'ENTREGADO' })
      .getCount();

    const overdueSubmissionsCount = await this.assignmentsRepo
      .createQueryBuilder('s')
      .where('s.projectId = :courseId', { courseId })
      .andWhere('s.status = :status', { status: 'ENTREGADO' })
      .andWhere('s.deadline IS NOT NULL')
      .andWhere('s.deadline < NOW()')
      .getCount();

    const unansweredThreadsCount = await this.threadsRepo
      .createQueryBuilder('t')
      .where('t.courseId = :courseId', { courseId })
      .andWhere('t.status = :status', { status: 'UNANSWERED' })
      .getCount();

    const lastEvent = await this.feedRepo
      .createQueryBuilder('e')
      .select('MAX(e.createdAt)', 'max')
      .where('e.courseId = :courseId', { courseId })
      .getRawOne<{ max: string | null }>();

    const lastActivityAt = lastEvent?.max ? new Date(lastEvent.max) : project.updatedAt || null;

    await this.courseStatsRepo.update(
      { courseId },
      {
        teacherId: resolvedTeacherId,
        studentsCount,
        pendingSubmissionsCount,
        unansweredThreadsCount,
        overdueSubmissionsCount,
        lastActivityAt,
        updatedAt: new Date(),
      } as any,
    );

    const updated = await this.courseStatsRepo.findOne({ where: { courseId } });
    return updated!;
  }

  async recomputeTeacherStats(teacherId: number): Promise<TeacherStats> {
    const rows = await this.courseStatsRepo.find({ where: { teacherId } });
    const pendingSubmissionsCount = rows.reduce((sum, r) => sum + (r.pendingSubmissionsCount || 0), 0);
    const unansweredThreadsCount = rows.reduce((sum, r) => sum + (r.unansweredThreadsCount || 0), 0);
    const overdueCount = rows.reduce((sum, r) => sum + (r.overdueSubmissionsCount || 0), 0);

    const existing = await this.teacherStatsRepo.findOne({ where: { teacherId } });
    if (!existing) {
      const created = this.teacherStatsRepo.create({
        teacherId,
        pendingSubmissionsCount,
        unansweredThreadsCount,
        overdueCount,
      });
      return this.teacherStatsRepo.save(created);
    }

    await this.teacherStatsRepo.update(
      { teacherId },
      {
        pendingSubmissionsCount,
        unansweredThreadsCount,
        overdueCount,
        updatedAt: new Date(),
      } as any,
    );
    return (await this.teacherStatsRepo.findOne({ where: { teacherId } }))!;
  }
}
