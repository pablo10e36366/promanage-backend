import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { ReviewSubmissionDto } from '../../application/dto/review-submission.dto';
import { TeacherSubmissionsQueryDto } from '../../application/dto/teacher-submissions.query.dto';
import { TeacherSubmissionsService } from '../../application/services/teacher-submissions.service';

@Controller('teacher/submissions')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherSubmissionsController {
  constructor(private readonly submissionsService: TeacherSubmissionsService) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: number } },
    @Query() query: TeacherSubmissionsQueryDto,
  ): Promise<TeacherApiResponse<any>> {
    const result = await this.submissionsService.list(req.user.id, query);
    return {
      data: {
        items: result.items,
        next_pending_submission_id: result.next_pending_submission_id,
      },
      meta: { page: result.page, page_size: result.page_size, total: result.total },
    };
  }

  @Get(':id')
  async getOne(
    @Req() req: Request & { user: { id: number } },
    @Param('id') id: string,
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.submissionsService.getOne(req.user.id, id);
    return { data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async review(
    @Req() req: Request & { user: { id: number } },
    @Param('id') id: string,
    @Body() dto: ReviewSubmissionDto,
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.submissionsService.review(req.user.id, id, dto);
    return { data };
  }

  @Get(':id/next')
  @HttpCode(HttpStatus.OK)
  async next(
    @Req() req: Request & { user: { id: number } },
    @Param('id') id: string,
    @Query() query: TeacherSubmissionsQueryDto,
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.submissionsService.next(req.user.id, id, query);
    return { data };
  }
}


