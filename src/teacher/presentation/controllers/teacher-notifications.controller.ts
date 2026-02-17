import {
  Controller,
  Get,
  Query,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { TeacherApiExceptionFilter } from '../filters/teacher-api-exception.filter';
import type { TeacherApiResponse } from '../teacher-api.types';
import { TeacherNotificationsService } from '../../application/services/teacher-notifications.service';
import { TeacherNotificationsQueryDto } from '../../application/dto/teacher-notifications.query.dto';

@Controller('teacher/notifications')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherNotificationsController {
  constructor(private readonly notificationsService: TeacherNotificationsService) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: number } },
    @Query() query: TeacherNotificationsQueryDto,
  ): Promise<TeacherApiResponse<{ items: any[] }>> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;

    const { items, total } = await this.notificationsService.listNotifications({
      teacherId: req.user.id,
      page,
      pageSize,
    });

    return {
      data: { items },
      meta: { page, page_size: pageSize, total },
    };
  }

  @Get('badges')
  async badges(
    @Req() req: Request & { user: { id: number } },
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.notificationsService.getBadges(req.user.id);
    return { data };
  }
}


