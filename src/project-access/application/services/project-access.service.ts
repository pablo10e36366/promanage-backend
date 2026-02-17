import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectAccess,
  ProjectPermission,
  AccessStatus,
} from '../../infrastructure/entities/project-access.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectRepository(ProjectAccess)
    private readonly projectAccessRepository: Repository<ProjectAccess>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Solicitar acceso a un proyecto
   */
  async requestAccess(
    userId: number,
    projectId: string,
    permission: ProjectPermission,
    notes?: string,
  ): Promise<ProjectAccess> {
    // Verificar que el proyecto existe
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['owner'],
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    // No puede solicitar acceso a su propio proyecto
    if (project.owner.id === userId) {
      throw new BadRequestException('No puedes solicitar acceso a tu propio proyecto');
    }

    // Verificar si ya tiene una solicitud activa
    const existing = await this.projectAccessRepository.findOne({
      where: { project: { id: projectId }, user: { id: userId } },
    });

    if (existing) {
      if (existing.status === AccessStatus.PENDING) {
        throw new ConflictException('Ya tienes una solicitud pendiente para este proyecto');
      }
      if (existing.status === AccessStatus.APPROVED) {
        throw new ConflictException('Ya tienes acceso a este proyecto');
      }
      // Si fue REJECTED o REVOKED, permitir nueva solicitud actualizando el registro
      existing.permission = permission;
      existing.status = AccessStatus.PENDING;
      existing.notes = notes;
      existing.requestedAt = new Date();
      delete existing.resolvedAt;
      delete existing.grantedBy;
      return this.projectAccessRepository.save(existing);
    }

    // Crear nueva solicitud
    const request = this.projectAccessRepository.create({
      project,
      user: { id: userId } as User,
      permission,
      status: AccessStatus.PENDING,
      notes,
    });

    return this.projectAccessRepository.save(request);
  }

  /**
   * Aprobar una solicitud de acceso
   */
  async approveRequest(ownerId: number, requestId: string): Promise<ProjectAccess> {
    const request = await this.projectAccessRepository.findOne({
      where: { id: requestId },
      relations: ['project', 'project.owner', 'user'],
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    // Solo el owner puede aprobar
    if (request.project.owner.id !== ownerId) {
      throw new ForbiddenException('Solo el propietario puede aprobar solicitudes');
    }

    if (request.status !== AccessStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    request.status = AccessStatus.APPROVED;
    request.grantedBy = { id: ownerId } as User;
    request.resolvedAt = new Date();

    return this.projectAccessRepository.save(request);
  }

  /**
   * Rechazar una solicitud de acceso
   */
  async rejectRequest(ownerId: number, requestId: string, notes?: string): Promise<ProjectAccess> {
    const request = await this.projectAccessRepository.findOne({
      where: { id: requestId },
      relations: ['project', 'project.owner', 'user'],
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    // Solo el owner puede rechazar
    if (request.project.owner.id !== ownerId) {
      throw new ForbiddenException('Solo el propietario puede rechazar solicitudes');
    }

    if (request.status !== AccessStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    request.status = AccessStatus.REJECTED;
    request.grantedBy = { id: ownerId } as User;
    request.resolvedAt = new Date();
    if (notes) {
      request.notes = notes;
    }

    return this.projectAccessRepository.save(request);
  }

  /**
   * Revocar acceso de un usuario (cambia status a REVOKED)
   */
  async revokeAccess(ownerId: number, projectId: string, userId: number): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['owner'],
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    if (project.owner.id !== ownerId) {
      throw new ForbiddenException('Solo el propietario puede revocar permisos');
    }

    const access = await this.projectAccessRepository.findOne({
      where: { project: { id: projectId }, user: { id: userId } },
    });

    if (!access) {
      throw new NotFoundException('Permiso no encontrado');
    }

    if (access.status !== AccessStatus.APPROVED) {
      throw new BadRequestException('Solo se pueden revocar permisos aprobados');
    }

    access.status = AccessStatus.REVOKED;
    access.resolvedAt = new Date();
    await this.projectAccessRepository.save(access);
  }

  /**
   * Cambiar tipo de permiso (de VIEW a EDIT o viceversa)
   */
  async changePermission(
    ownerId: number,
    requestId: string,
    newPermission: ProjectPermission,
  ): Promise<ProjectAccess> {
    const access = await this.projectAccessRepository.findOne({
      where: { id: requestId },
      relations: ['project', 'project.owner'],
    });

    if (!access) {
      throw new NotFoundException('Permiso no encontrado');
    }

    if (access.project.owner.id !== ownerId) {
      throw new ForbiddenException('Solo el propietario puede cambiar permisos');
    }

    if (access.status !== AccessStatus.APPROVED) {
      throw new BadRequestException('Solo se pueden cambiar permisos aprobados');
    }

    access.permission = newPermission;
    return this.projectAccessRepository.save(access);
  }

  /**
   * Obtener solicitudes de un proyecto
   */
  async getProjectRequests(projectId: string, status?: AccessStatus): Promise<ProjectAccess[]> {
    const where: any = { project: { id: projectId } };
    if (status) {
      where.status = status;
    }

    return this.projectAccessRepository.find({
      where,
      relations: ['user', 'grantedBy'],
      order: { requestedAt: 'DESC' },
    });
  }

  /**
   * Obtener el permiso de un usuario en un proyecto especÃ­fico
   */
  async getUserPermission(userId: number, projectId: string): Promise<ProjectAccess | null> {
    return this.projectAccessRepository.findOne({
      where: {
        user: { id: userId },
        project: { id: projectId },
      },
      relations: ['project', 'project.owner'],
    });
  }

  /**
   * Obtener todas las solicitudes de un usuario
   */
  async getMyRequests(userId: number): Promise<ProjectAccess[]> {
    return this.projectAccessRepository.find({
      where: { user: { id: userId } },
      relations: ['project', 'project.owner', 'grantedBy'],
      order: { requestedAt: 'DESC' },
    });
  }

  /**
   * Verificar si un usuario puede VER un proyecto
   */
  async canView(userId: number, projectId: string): Promise<boolean> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['owner'],
    });

    if (!project) {
      return false;
    }

    // El owner siempre puede ver
    if (project.owner.id === userId) {
      return true;
    }

    // Verificar permisos aprobados (VIEW o EDIT)
    const access = await this.projectAccessRepository.findOne({
      where: {
        user: { id: userId },
        project: { id: projectId },
        status: AccessStatus.APPROVED,
      },
    });

    return !!access;
  }

  /**
   * Verificar si un usuario puede EDITAR un proyecto
   */
  async canEdit(userId: number, projectId: string): Promise<boolean> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['owner'],
    });

    if (!project) {
      return false;
    }

    // El owner siempre puede editar
    if (project.owner.id === userId) {
      return true;
    }

    // Verificar permiso EDIT aprobado
    const access = await this.projectAccessRepository.findOne({
      where: {
        user: { id: userId },
        project: { id: projectId },
        status: AccessStatus.APPROVED,
        permission: ProjectPermission.EDIT,
      },
    });

    return !!access;
  }
}


