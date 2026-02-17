import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CreateTeacherCourseDto } from '../../application/dto/create-teacher-course.dto';
import { TeacherCoursesQueryDto } from '../../application/dto/teacher-courses.query.dto';
import { TeacherCoursesService } from '../../application/services/teacher-courses.service';

@Controller('teacher/courses')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherCoursesController {
  constructor(private readonly coursesService: TeacherCoursesService) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: number } },
    @Query() query: TeacherCoursesQueryDto,
  ): Promise<TeacherApiResponse<{ items: any[] }>> {
    const teacherId = req.user.id;
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;

    const { items, total } = await this.coursesService.listCourses({
      teacherId,
      page,
      pageSize,
      search: query.search,
      sort: query.sort,
    });

    return {
      data: { items },
      meta: { page, page_size: pageSize, total },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: CreateTeacherCourseDto,
  ): Promise<TeacherApiResponse<any>> {
    const teacherId = req.user.id;
    const created = await this.coursesService.createCourse(teacherId, dto);
    return { data: created };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(
    @Req() req: Request & { user: { id: number } },
    @Param('id') id: string,
  ): Promise<TeacherApiResponse<any>> {
    const course = await this.coursesService.assertTeacherOwnsCourse(req.user.id, id);
    return {
      data: {
        id: course.id,
        name: course.title,
        code: course.code,
        description: course.description ?? null,
      },
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Req() req: Request & { user: { id: number } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeacherApiResponse<{ deleted: true }>> {
    await this.coursesService.deleteCourse(req.user.id, id);
    return { data: { deleted: true } };
  }
}


