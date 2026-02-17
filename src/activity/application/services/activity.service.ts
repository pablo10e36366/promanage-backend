import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActivityAction,
  ActivityLog,
  Reactions,
} from '../../infrastructure/entities/activity-log.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityRepo: Repository<ActivityLog>,
  ) {}

  async logActivity(
    user: User,
    action: ActivityAction,
    metadata?: any,
  ): Promise<ActivityLog> {
    const log = this.activityRepo.create({
      user,
      action,
      metadata,
      reactions: {},
    });
    return this.activityRepo.save(log);
  }

  async getHeatmap(userId: number): Promise<{ date: string; count: number }[]> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await this.activityRepo
      .createQueryBuilder('log')
      .select("TO_CHAR(log.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('log.user.id = :userId', { userId })
      .andWhere('log.createdAt >= :oneYearAgo', { oneYearAgo })
      .groupBy("TO_CHAR(log.createdAt, 'YYYY-MM-DD')")
      .getRawMany();

    return result.map((item) => ({
      date: item.date,
      count: parseInt(item.count, 10),
    }));
  }

  async findRecentActivities(
    userId: number,
    since?: Date,
  ): Promise<ActivityLog[]> {
    const qb = this.activityRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.user.id = :userId', { userId })
      .orderBy('log.createdAt', 'DESC')
      .take(50);

    if (since) {
      qb.andWhere('log.createdAt > :since', { since });
    }

    return qb.getMany();
  }

  async findByProject(projectId: string): Promise<ActivityLog[]> {
    return this.activityRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where("log.metadata->>'projectId' = :projectId", { projectId })
      .orderBy('log.createdAt', 'DESC')
      .getMany();
  }

  async getGlobalFeed(limit = 50, offset = 0): Promise<ActivityLog[]> {
    return this.activityRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async addReaction(
    activityId: number,
    emoji: string,
    userId: number,
  ): Promise<ActivityLog> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) {
      throw new NotFoundException(`Actividad ${activityId} no encontrada`);
    }

    const reactions: Reactions = activity.reactions || {};

    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
    }

    await this.activityRepo.update(activityId, { reactions });
    const updated = await this.activityRepo.findOne({
      where: { id: activityId },
      relations: ['user'],
    });
    return updated!;
  }

  async removeReaction(
    activityId: number,
    emoji: string,
    userId: number,
  ): Promise<ActivityLog> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) {
      throw new NotFoundException(`Actividad ${activityId} no encontrada`);
    }

    const reactions: Reactions = activity.reactions || {};

    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter((id) => id !== userId);

      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }

    await this.activityRepo.update(activityId, { reactions });
    const updated = await this.activityRepo.findOne({
      where: { id: activityId },
      relations: ['user'],
    });
    return updated!;
  }

  async toggleReaction(
    activityId: number,
    emoji: string,
    userId: number,
  ): Promise<{ action: 'added' | 'removed'; activity: ActivityLog }> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) {
      throw new NotFoundException(`Actividad ${activityId} no encontrada`);
    }

    const reactions: Reactions = activity.reactions || {};
    const hasReacted = reactions[emoji]?.includes(userId) ?? false;

    if (hasReacted) {
      const updated = await this.removeReaction(activityId, emoji, userId);
      return { action: 'removed', activity: updated };
    } else {
      const updated = await this.addReaction(activityId, emoji, userId);
      return { action: 'added', activity: updated };
    }
  }

  async getSystemStats(): Promise<any> {
    const totalActivities = await this.activityRepo.count();

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    await this.activityRepo.count({
      where: {
        createdAt: (qb) => `createdAt > '${oneWeekAgo.toISOString()}'`,
      } as any,
    });

    const recentCount = await this.activityRepo
      .createQueryBuilder('log')
      .where('log.createdAt > :date', { date: oneWeekAgo })
      .getCount();

    return {
      totalActivities,
      recentActivities: recentCount,
    };
  }

  async getTimeline(filters: {
    userId?: number;
    projectId?: string;
    action?: ActivityAction[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ActivityLog[]; total: number }> {
    const qb = this.activityRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .take(filters.limit || 50)
      .skip(filters.offset || 0);

    if (filters.userId) {
      qb.andWhere('log.user.id = :userId', { userId: filters.userId });
    }

    if (filters.projectId) {
      qb.andWhere("log.metadata->>'projectId' = :projectId", {
        projectId: filters.projectId,
      });
    }

    if (filters.action && filters.action.length > 0) {
      qb.andWhere('log.action IN (:...actions)', { actions: filters.action });
    }

    if (filters.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
