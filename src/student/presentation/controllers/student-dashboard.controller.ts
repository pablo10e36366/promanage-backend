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
import { StudentApiExceptionFilter } from '../filters/student-api-exception.filter';
import type { StudentApiResponse } from '../student-api.types';
import { StudentDashboardService } from '../../application/services/student-dashboard.service';

@Controller('student/dashboard')
@Roles('colaborador')
@UseFilters(StudentApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StudentDashboardController {
  constructor(private readonly dashboardService: StudentDashboardService) {}

  @Get()
  async getDashboard(
    @Req() req: Request & { user: { id: number } },
  ): Promise<
    StudentApiResponse<{
      pending_total: number;
      overdue_total: number;
      pending_items: any[];
      overdue_items: any[];
    }>
  > {
    const result = await this.dashboardService.getDashboard({
      studentId: req.user.id,
    });

    return {
      data: {
        pending_total: result.pending_total,
        overdue_total: result.overdue_total,
        pending_items: result.pending_items,
        overdue_items: result.overdue_items,
      },
    };
  }
}


