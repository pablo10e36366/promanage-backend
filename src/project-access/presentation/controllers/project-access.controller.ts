import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { ProjectAccessService } from '../../application/services/project-access.service';
import { RequestAccessDto } from '../dto/request-access.dto';
import { RespondToRequestDto } from '../dto/respond-to-request.dto';
import { ChangePermissionDto } from '../dto/change-permission.dto';
import { AccessStatus } from '../../infrastructure/entities/project-access.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectAccessController {
  constructor(private readonly projectAccessService: ProjectAccessService) {}

  /**
   * Solicitar acceso a un proyecto
   * POST /projects/:id/access
   */
  @Post('projects/:id/access')
  requestAccess(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Req() req: Request & { user: User },
    @Body() dto: RequestAccessDto,
  ) {
    return this.projectAccessService.requestAccess(
      req.user.id,
      projectId,
      dto.permission,
      dto.notes,
    );
  }

  /**
   * Listar solicitudes y permisos de un proyecto (solo owner)
   * GET /projects/:id/access?status=PENDING
   */
  @Get('projects/:id/access')
  getProjectAccess(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Query('status') status?: AccessStatus,
  ) {
    return this.projectAccessService.getProjectRequests(projectId, status);
  }

  /**
   * Aprobar o rechazar solicitud
   * PATCH /projects/:projectId/access/:requestId
   */
  @Patch('projects/:projectId/access/:requestId')
  respondToRequest(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: Request & { user: User },
    @Body() dto: RespondToRequestDto,
  ) {
    if (dto.action === 'APPROVED') {
      return this.projectAccessService.approveRequest(req.user.id, requestId);
    }
    return this.projectAccessService.rejectRequest(req.user.id, requestId, dto.notes);
  }

  /**
   * Cambiar tipo de permiso (VIEW <-> EDIT)
   * PATCH /projects/:projectId/access/:requestId/permission
   */
  @Patch('projects/:projectId/access/:requestId/permission')
  changePermission(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: Request & { user: User },
    @Body() dto: ChangePermissionDto,
  ) {
    return this.projectAccessService.changePermission(req.user.id, requestId, dto.permission);
  }

  /**
   * Revocar acceso de un usuario
   * DELETE /projects/:projectId/access/:userId
   */
  @Delete('projects/:projectId/access/:userId')
  revokeAccess(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request & { user: User },
  ) {
    return this.projectAccessService.revokeAccess(req.user.id, projectId, userId);
  }

  /**
   * Mis solicitudes de acceso
   * GET /my-access-requests
   */
  @Get('my-access-requests')
  getMyRequests(@Req() req: Request & { user: User }) {
    return this.projectAccessService.getMyRequests(req.user.id);
  }

  /**
   * Verificar mis permisos en un proyecto
   * GET /projects/:id/my-permission
   */
  @Get('projects/:id/my-permission')
  async checkMyPermission(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Req() req: Request & { user: User },
  ) {
    const canView = await this.projectAccessService.canView(req.user.id, projectId);
    const canEdit = await this.projectAccessService.canEdit(req.user.id, projectId);
    const permission = await this.projectAccessService.getUserPermission(req.user.id, projectId);

    return {
      canView,
      canEdit,
      permission,
    };
  }
}


