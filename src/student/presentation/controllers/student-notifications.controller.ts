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
import { StudentApiExceptionFilter } from '../filters/student-api-exception.filter';
import type { StudentApiResponse } from '../student-api.types';
import { StudentNotificationsQueryDto } from '../dto/student-notifications.query.dto';
import { StudentNotificationsService } from '../../application/services/student-notifications.service';

@Controller('student/notifications')
@Roles('colaborador')
@UseFilters(StudentApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StudentNotificationsController {
  constructor(private readonly notificationsService: StudentNotificationsService) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: number } },
    @Query() query: StudentNotificationsQueryDto,
  ): Promise<StudentApiResponse<{ items: any[] }>> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;

    const { items, total } = await this.notificationsService.listNotifications({
      studentId: req.user.id,
      page,
      pageSize,
    });

    return {
      data: { items },
      meta: { page, page_size: pageSize, total },
    };
  }
}


