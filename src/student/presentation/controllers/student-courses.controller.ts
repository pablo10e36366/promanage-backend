import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Param,
  UseFilters,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { StudentApiExceptionFilter } from '../filters/student-api-exception.filter';
import type { StudentApiResponse } from '../student-api.types';
import { StudentCoursesQueryDto } from '../dto/student-courses.query.dto';
import { StudentCoursesService } from '../../application/services/student-courses.service';
import { ProjectAccessService } from '../../../project-access/application/services/project-access.service';
import { ProjectPermission } from '../../../project-access/infrastructure/entities/project-access.entity';

@Controller('student/courses')
@Roles('colaborador')
@UseFilters(StudentApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StudentCoursesController {
  constructor(
    private readonly coursesService: StudentCoursesService,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: number } },
    @Query() query: StudentCoursesQueryDto,
  ): Promise<StudentApiResponse<{ items: any[] }>> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;
    const search = query.q ?? query.search;

    const { items, total } = await this.coursesService.listCourses({
      studentId: req.user.id,
      page,
      pageSize,
      search,
    });

    return {
      data: { items },
      meta: { page, page_size: pageSize, total },
    };
  }

  @Get('available')
  async listAvailable(
    @Req() req: Request & { user: { id: number } },
    @Query() query: StudentCoursesQueryDto,
  ): Promise<StudentApiResponse<{ items: any[] }>> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;
    const search = query.q ?? query.search;

    const { items, total } = await this.coursesService.listAvailableCourses({
      studentId: req.user.id,
      page,
      pageSize,
      search,
    });

    return {
      data: { items },
      meta: { page, page_size: pageSize, total },
    };
  }

  @Post(':id/join')
  async requestJoin(
    @Req() req: Request & { user: { id: number } },
    @Param('id', ParseUUIDPipe) courseId: string,
  ): Promise<StudentApiResponse<{ join_status: string; join_request_id: string }>> {
    const access = await this.projectAccessService.requestAccess(
      req.user.id,
      courseId,
      ProjectPermission.VIEW,
      'Solicitud de inscripciÃ³n al curso',
    );

    return {
      data: {
        join_status: access.status,
        join_request_id: access.id,
      },
    };
  }
}

