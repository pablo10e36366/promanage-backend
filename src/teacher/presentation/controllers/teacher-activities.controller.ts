import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { TeacherApiExceptionFilter } from '../filters/teacher-api-exception.filter';
import type { TeacherApiResponse } from '../teacher-api.types';
import { CreateTeacherActivityDto } from '../../application/dto/create-teacher-activity.dto';
import { TeacherActivitiesService } from '../../application/services/teacher-activities.service';

@Controller('teacher/courses')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherActivitiesController {
  constructor(private readonly activitiesService: TeacherActivitiesService) {}

  @Post(':courseId/activities')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request & { user: { id: number } },
    @Param('courseId') courseId: string,
    @Body() dto: CreateTeacherActivityDto,
  ): Promise<TeacherApiResponse<any>> {
    const result = await this.activitiesService.createActivity({
      teacherId: req.user.id,
      courseId,
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type ?? null,
      deadline: dto.deadline ?? null,
    });
    return { data: result };
  }

  @Delete(':courseId/activities/:activityId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Req() req: Request & { user: { id: number } },
    @Param('courseId') courseId: string,
    @Param('activityId') activityId: string,
  ): Promise<TeacherApiResponse<{ deleted: true; removed_assignments: number }>> {
    const result = await this.activitiesService.deleteActivity({
      teacherId: req.user.id,
      courseId,
      activityId,
    });
    return { data: result };
  }
}


