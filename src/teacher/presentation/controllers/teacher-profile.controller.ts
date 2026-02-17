import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { TeacherApiExceptionFilter } from '../filters/teacher-api-exception.filter';
import type { TeacherApiResponse } from '../teacher-api.types';
import { UpdateTeacherProfileDto } from '../../application/dto/update-teacher-profile.dto';
import { TeacherProfileService } from '../../application/services/teacher-profile.service';

@Controller('teacher/profile')
@Roles('docente')
@UseFilters(TeacherApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TeacherProfileController {
  constructor(private readonly profileService: TeacherProfileService) {}

  @Get()
  async getProfile(@Req() req: Request & { user: { id: number } }): Promise<TeacherApiResponse<any>> {
    const data = await this.profileService.getProfile(req.user.id);
    return { data };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: UpdateTeacherProfileDto,
  ): Promise<TeacherApiResponse<any>> {
    const data = await this.profileService.updateProfile(req.user.id, dto);
    return { data };
  }
}


