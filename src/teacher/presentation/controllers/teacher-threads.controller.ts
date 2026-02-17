import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CreateThreadReplyDto } from '../../application/dto/create-thread-reply.dto';
import { TeacherThreadsQueryDto } from '../../application/dto/teacher-threads.query.dto';
import { UpdateThreadStatusDto } from '../../application/dto/update-thread-status.dto';
import { TeacherThreadsService } from '../../application/services/teacher-threads.service';

@Controller('teacher/threads')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherThreadsController {
  constructor(private readonly threadsService: TeacherThreadsService) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: number } },
    @Query() query: TeacherThreadsQueryDto,
  ): Promise<TeacherApiResponse<any>> {
    const result = await this.threadsService.list(req.user.id, query);
    return {
      data: { items: result.items },
      meta: { page: result.page, page_size: result.page_size, total: result.total },
    };
  }

  @Get(':id')
  async getOne(
    @Req() req: Request & { user: { id: number } },
    @Param('id') id: string,
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.threadsService.getOne(req.user.id, id);
    return { data };
  }

  @Post(':id/replies')
  @HttpCode(HttpStatus.CREATED)
  async reply(
    @Req() req: Request & { user: { id: number } },
    @Param('id') id: string,
    @Body() dto: CreateThreadReplyDto,
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.threadsService.reply(req.user.id, id, dto.message);
    return { data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Req() req: Request & { user: { id: number } },
    @Param('id') id: string,
    @Body() dto: UpdateThreadStatusDto,
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.threadsService.updateStatus(req.user.id, id, dto.status);
    return { data };
  }
}


