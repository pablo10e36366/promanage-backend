import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { ActivityFeedEvent } from '../../infrastructure/entities/activity-feed-event.entity';
import { TeacherActivityFeedQueryDto } from '../dto/teacher-activity-feed.query.dto';

function iso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}

@Injectable()
export class TeacherActivityFeedService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
  ) {}

  async listCourseFeed(teacherId: number, courseId: string, query: TeacherActivityFeedQueryDto) {
    const course = await this.projectsRepo.findOne({
      where: { id: courseId },
      relations: ['owner'],
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (course.owner?.id !== teacherId) throw new ForbiddenException('No tienes acceso a este curso');

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;

    const qb = this.feedRepo
      .createQueryBuilder('e')
      .where('e.teacherId = :teacherId', { teacherId })
      .andWhere('e.courseId = :courseId', { courseId });

    if (query.type) {
      qb.andWhere('e.type = :type', { type: query.type });
    }

    qb.orderBy('e.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [rows, total] = await qb.getManyAndCount();

    const items = rows.map((e) => ({
      id: e.id,
      type: e.type,
      course_id: e.courseId,
      actor_type: e.actorType,
      actor_name: e.actorName,
      entity_id: e.entityId,
      title: e.title,
      created_at: iso(e.createdAt),
      metadata: e.metadata ?? null,
    }));

    return {
      items,
      page,
      page_size: pageSize,
      total,
    };
  }
}

