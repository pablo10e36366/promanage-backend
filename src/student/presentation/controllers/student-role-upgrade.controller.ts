import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { StudentApiExceptionFilter } from '../filters/student-api-exception.filter';
import type { StudentApiResponse } from '../student-api.types';
import { CreateRoleUpgradeRequestDto } from '../dto/create-role-upgrade-request.dto';
import { StudentRoleUpgradeService } from '../../application/services/student-role-upgrade.service';

@Controller('student/role-requests')
@Roles('colaborador')
@UseFilters(StudentApiExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StudentRoleUpgradeController {
  constructor(
    private readonly studentRoleUpgradeService: StudentRoleUpgradeService,
  ) {}

  @Get('teacher')
  async getLatestTeacherRequest(
    @Req() req: Request & { user: { id: number } },
  ): Promise<StudentApiResponse<{ request: any | null }>> {
    const request = await this.studentRoleUpgradeService.getLatestRequest(req.user.id);
    return { data: { request } };
  }

  @Post('teacher')
  async createTeacherRequest(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: CreateRoleUpgradeRequestDto,
  ): Promise<StudentApiResponse<{ request: any }>> {
    const request = await this.studentRoleUpgradeService.createTeacherRequest(
      req.user.id,
      dto.message,
    );
    return { data: { request } };
  }
}
