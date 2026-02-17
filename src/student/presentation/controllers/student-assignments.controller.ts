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
import { StudentAssignmentsQueryDto } from '../dto/student-assignments.query.dto';
import { StudentAssignmentsService } from '../../application/services/student-assignments.service';

@Controller('student/assignments')
@Roles('colaborador')
@UseFilters(StudentApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StudentAssignmentsController {
  constructor(private readonly assignmentsService: StudentAssignmentsService) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: number } },
    @Query() query: StudentAssignmentsQueryDto,
  ): Promise<StudentApiResponse<{ items: any[] }>> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;

    const result = await this.assignmentsService.list({
      studentId: req.user.id,
      page,
      pageSize,
      courseId: query.course_id,
      status: query.status,
      q: query.q,
      sort: query.sort,
    });

    return {
      data: { items: result.items },
      meta: { page: result.page, page_size: result.page_size, total: result.total },
    };
  }
}


