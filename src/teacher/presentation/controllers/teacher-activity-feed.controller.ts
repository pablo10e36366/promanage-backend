import {
  Controller,
  Get,
  Param,
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
import { TeacherActivityFeedQueryDto } from '../../application/dto/teacher-activity-feed.query.dto';
import { TeacherActivityFeedService } from '../../application/services/teacher-activity-feed.service';

@Controller('teacher/courses')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherActivityFeedController {
  constructor(private readonly feedService: TeacherActivityFeedService) {}

  @Get(':id/activity-feed')
  async courseFeed(
    @Req() req: Request & { user: { id: number } },
    @Param('id') courseId: string,
    @Query() query: TeacherActivityFeedQueryDto,
  ): Promise<TeacherApiResponse<any>> {
    const result = await this.feedService.listCourseFeed(req.user.id, courseId, query);
    return {
      data: { items: result.items },
      meta: { page: result.page, page_size: result.page_size, total: result.total },
    };
  }
}


