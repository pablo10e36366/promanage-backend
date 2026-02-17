import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { VersionsService } from '../../application/services/versions.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../roles/presentation/guards/roles.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Controller('evidences/:evidenceId/versions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  @Get()
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async findAll(@Param('evidenceId', ParseUUIDPipe) evidenceId: string) {
    return this.versionsService.findByEvidence(evidenceId);
  }

  @Post()
  @Roles('colaborador', 'admin')
  async createVersion(
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Req() req: Request & { user: User },
    @Body('description') description?: string,
  ) {
    return this.versionsService.createVersion(
      evidenceId,
      req.user,
      description,
    );
  }

  @Get(':versionId')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async findOne(@Param('versionId', ParseUUIDPipe) versionId: string) {
    return this.versionsService.findOne(versionId);
  }

  @Post(':versionId/restore')
  @Roles('colaborador', 'admin')
  async restoreVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: Request & { user: User },
  ) {
    return this.versionsService.restoreVersion(versionId, req.user);
  }

  @Get('compare/:versionId1/:versionId2')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async compareVersions(
    @Param('versionId1', ParseUUIDPipe) versionId1: string,
    @Param('versionId2', ParseUUIDPipe) versionId2: string,
  ) {
    return this.versionsService.compareVersions(versionId1, versionId2);
  }
}

