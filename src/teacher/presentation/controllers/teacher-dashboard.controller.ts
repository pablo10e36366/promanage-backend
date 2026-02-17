import {
  Controller,
  Get,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { TeacherApiExceptionFilter } from '../filters/teacher-api-exception.filter';
import type { TeacherApiResponse } from '../teacher-api.types';
import { TeacherDashboardService } from '../../application/services/teacher-dashboard.service';

@Controller('teacher/dashboard')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherDashboardController {
  constructor(private readonly dashboardService: TeacherDashboardService) {}

  @Get()
  async get(
    @Req() req: Request & { user: { id: number } },
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.dashboardService.getDashboard(req.user.id);
    return { data };
  }
}

