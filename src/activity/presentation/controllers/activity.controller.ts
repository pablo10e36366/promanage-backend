import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { ActivityService } from '../../application/services/activity.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../roles/presentation/guards/roles.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get(':id/stats/heatmap')
  getHeatmap(@Param('id') id: number) {
    return this.activityService.getHeatmap(id);
  }
}

@Controller('activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  getRecentActivities(
    @Req() req: Request & { user: User },
    @Query('since') since?: string,
  ) {
    const sinceDate = since ? new Date(since) : undefined;
    return this.activityService.findRecentActivities(req.user.id, sinceDate);
  }

  @Get('feed')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  getGlobalFeed(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.activityService.getGlobalFeed(limit || 50, offset || 0);
  }

  @Get('timeline')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  getTimeline(
    @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.activityService.getTimeline({
      userId,
      projectId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });
  }

  @Post(':id/reactions')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin')
  async toggleReaction(
    @Param('id', ParseIntPipe) activityId: number,
    @Req() req: Request & { user: User },
    @Body('emoji') emoji: string,
  ) {
    return this.activityService.toggleReaction(activityId, emoji, req.user.id);
  }

  @Post(':id/reactions/:emoji')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin')
  async addReaction(
    @Param('id', ParseIntPipe) activityId: number,
    @Param('emoji') emoji: string,
    @Req() req: Request & { user: User },
  ) {
    return this.activityService.addReaction(activityId, emoji, req.user.id);
  }

  @Delete(':id/reactions/:emoji')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin')
  async removeReaction(
    @Param('id', ParseIntPipe) activityId: number,
    @Param('emoji') emoji: string,
    @Req() req: Request & { user: User },
  ) {
    return this.activityService.removeReaction(activityId, emoji, req.user.id);
  }
}
