import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../infrastructure/entities/project.entity';
import {
  ProjectStatus,
  isValidTransition,
  getNextValidStates,
  STATUS_LABELS,
} from '../../domain/project-status';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ShareProjectInput,
  RepositoryView,
  RepositoryHeader,
  ProjectDownloadInfo,
} from '../../domain/project.types';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { ActivityService } from '../../../activity/application/services/activity.service';
import { ActivityAction } from '../../../activity/infrastructure/entities/activity-log.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    private readonly activityService: ActivityService,
  ) {}

  /**
   * âœ… HARDENING: Valida que el usuario sea owner o admin
   */
  private async validateOwnership(projectId: string, user: User): Promise<Project> {
    const project = await this.projectsRepo.findOne({
      where: { id: projectId },
      relations: ['owner'],
    });

    if (!project) {
      throw new NotFoundException(`Proyecto ${projectId} no encontrado`);
    }

    const isOwner = project.owner.id === user.id;
    const isAdmin = user.role?.name === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para modificar este proyecto');
    }

    return project;
  }

  async create(
    createProjectInput: CreateProjectInput,
    user: User,
    id?: string,
    filename?: string,
  ): Promise<Project> {
    const projectId = id || uuidv4();
    const project = this.projectsRepo.create({
      id: projectId,
      ...createProjectInput,
      owner: user,
      filename,
    });
    const savedProject = await this.projectsRepo.save(project);
    await this.activityService.logActivity(
      user,
      ActivityAction.PROJECT_CREATE,
      {
        projectId: savedProject.id,
        title: savedProject.title,
      },
    );
    return savedProject;
  }

  // --- NLP SEARCH IMPLEMENTATION ---

  async search(query: string, user: User): Promise<Project[]> {
    const filters = this.parseSearchQuery(query);
    const qb = this.projectsRepo.createQueryBuilder('project');

    qb.leftJoinAndSelect('project.owner', 'owner');
    qb.where('owner.id = :userId', { userId: user.id });

    // 1. Filtro por Fecha (NLP)
    if (filters.dateRange) {
      // PostgreSQL syntax for interval
      qb.andWhere(`project.updatedAt >= NOW() - INTERVAL '${filters.dateRange}'`);
    }

    // 2. Filtro por Estado
    if (filters.status) {
      qb.andWhere('project.status = :status', { status: filters.status });
    }

    // 3. BÃºsqueda de Texto (Full Text Search simple con ILIKE)
    if (filters.text) {
      qb.andWhere(
        '(LOWER(project.title) LIKE :term OR LOWER(project.description) LIKE :term)',
        { term: `%${filters.text}%` },
      );
    }

    return qb.getMany();
  }

  private parseSearchQuery(query: string): {
    dateRange?: string;
    status?: ProjectStatus;
    text?: string;
  } {
    if (!query) return {};
    let text = query.toLowerCase();
    const result: any = {};

    // Regex para Fechas
    if (/(semana pasada|last week)/i.test(text)) {
      result.dateRange = '7 days';
      text = text.replace(/(proyectos de la )?semana pasada/i, '');
    } else if (/(mes pasado|last month)/i.test(text)) {
      result.dateRange = '30 days';
      text = text.replace(/(proyectos del )?mes pasado/i, '');
    } else if (/(ayer|yesterday)/i.test(text)) {
      result.dateRange = '1 day';
      text = text.replace(/ayer/i, '');
    }

    // Regex para Estados
    if (/borrador/i.test(text)) {
      result.status = ProjectStatus.DRAFT;
      text = text.replace(/borrador/i, '');
    } else if (/(completado|terminado)/i.test(text)) {
      result.status = ProjectStatus.COMPLETED;
      text = text.replace(/(completado|terminado)/i, '');
    } else if (/(en progreso|activo)/i.test(text)) {
      result.status = ProjectStatus.IN_PROGRESS;
      text = text.replace(/(en progreso|activo)/i, '');
    }

    // Limpiar texto restante
    result.text = text.trim();
    if (result.text === '') delete result.text;

    return result;
  }

  async findAll(): Promise<Project[]> {
    return this.projectsRepo.find({
      relations: ['owner'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findAllByUser(user: User): Promise<Project[]> {
    try {
      return await this.projectsRepo.find({
        where: { owner: { id: user.id } },
        order: { updatedAt: 'DESC' },
        relations: ['owner'],
      });
    } catch (error) {
      console.error(`Error fetching projects for user ${user.id}:`, error);
      return [];
    }
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async getRepositoryView(id: string, user: User): Promise<RepositoryView> {
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: [
        'owner',
        'milestones',
        'milestones.evidences',
        'milestones.evidences.author',
      ],
    });
    if (!project) throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);

    // Verificar permisos: solo admin o el propietario puede ver el repositorio
    const isAdmin = user.role?.name === 'admin';
    const isOwner = String(project.owner.id) === String(user.id);

    console.log(
      `[RepoView] Project ${id} | Owner: ${project.owner.id} | User: ${user.id} | IsOwner: ${isOwner}`,
    );

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('No tienes permiso para acceder a este proyecto');
    }

    const header: RepositoryHeader = {
      title: project.title,
      description: project.description || '',
      owner: project.owner.name,
      avatarUrl: '',
      status: project.status,
      tags: [],
    };
    return {
      header,
      stats: { commits: 0, contributors: 1, lastUpdate: 'now' },
      fileTree: [],
      readme: '',
    };
  }

  async getDownloadInfo(id: string): Promise<ProjectDownloadInfo> {
    const project = await this.findOne(id);

    if (!project.filename) {
      throw new NotFoundException('Este proyecto no tiene un archivo adjunto.');
    }

    return {
      filename: project.filename,
      filePath: join(process.cwd(), 'uploads', project.filename),
    };
  }

  /**
   * Share or schedule a project
   */
  async shareProject(
    projectId: string,
    user: User,
    shareInput: ShareProjectInput,
  ): Promise<{ success: boolean; message: string }> {
    // âœ… HARDENING: Validar ownership
    await this.validateOwnership(projectId, user);

    if (shareInput.action === 'share') {
      // Log the share action
      await this.activityService.logActivity(
        user,
        ActivityAction.PROJECT_CREATE,
        {
          projectId,
          action: 'shared',
          targetUserId: shareInput.targetUserId,
          message: shareInput.message,
        },
      );

      return {
        success: true,
        message: `Proyecto compartido${
          shareInput.targetUserId ? ' con usuario ' + shareInput.targetUserId : ''
        }`,
      };
    }

    if (shareInput.action === 'schedule') {
      // Update deadline if scheduling
      if (shareInput.scheduledDate) {
        await this.projectsRepo.update(projectId, {
          deadline: new Date(shareInput.scheduledDate),
        });
      }

      return {
        success: true,
        message: `Entrega programada para ${shareInput.scheduledDate}`,
      };
    }

    return { success: false, message: 'AcciÃ³n no reconocida' };
  }

  async update(id: string, updateData: UpdateProjectInput, user: User): Promise<Project> {
    // âœ… HARDENING: Validar ownership
    const project = await this.validateOwnership(id, user);

    const { title, description } = updateData;
    const changes: any = {};

    if (title !== undefined && title !== project.title) {
      changes.title = { from: project.title, to: title };
      project.title = title;
    }

    if (description !== undefined && description !== project.description) {
      changes.description = { from: project.description, to: description };
      project.description = description as any;
    }

    if (Object.keys(changes).length > 0) {
      await this.projectsRepo.save(project);

      // Log activity
      await this.activityService.logActivity(
        user,
        ActivityAction.PROJECT_UPDATE,
        {
          projectId: id,
          projectTitle: project.title,
          changes,
        },
      );
    }

    return project;
  }

  async remove(id: string, user: User): Promise<void> {
    // âœ… HARDENING: Validar ownership
    await this.validateOwnership(id, user);

    // Note: This is already a hard delete, consider making it soft delete
    await this.projectsRepo.delete(id);
  }

  // ===== ADMIN CONTROLS =====

  /**
   * Force status change (admin only, bypasses validation)
   */
  async forceStatusChange(
    id: string,
    newStatus: ProjectStatus,
    reason: string,
    adminUser: User,
  ): Promise<Project> {
    const project = await this.findOne(id);
    const currentStatus = project.status;

    await this.projectsRepo.update(id, { status: newStatus });

    // Log forced status change
    await this.activityService.logActivity(
      adminUser,
      ActivityAction.PROJECT_STATUS_CHANGE,
      {
        projectId: id,
        projectTitle: project.title,
        previousStatus: currentStatus,
        newStatus: newStatus,
        forced: true,
        reason,
      },
    );

    return this.findOne(id);
  }

  /**
   * Archive project (admin only)
   */
  async archiveProject(
    id: string,
    reason: string | undefined,
    adminUser: User,
  ): Promise<Project> {
    const project = await this.findOne(id);

    project.isArchived = true;
    project.archivedAt = new Date();
    project.archivedBy = adminUser.id;

    await this.projectsRepo.save(project);

    // Log archive action
    await this.activityService.logActivity(
      adminUser,
      ActivityAction.PROJECT_ARCHIVE,
      {
        projectId: id,
        projectTitle: project.title,
        reason,
      },
    );

    return project;
  }

  /**
   * Cambia el estado de un proyecto con validaciÃ³n de transiciones
   */
  async changeStatus(
    id: string,
    newStatus: ProjectStatus,
    user: User,
  ): Promise<Project> {
    const project = await this.findOne(id);
    const currentStatus = project.status;

    // Verificar que la transiciÃ³n sea vÃ¡lida
    if (!isValidTransition(currentStatus, newStatus)) {
      const validStates = getNextValidStates(currentStatus);
      const validLabels = validStates.map((s) => STATUS_LABELS[s]).join(', ');
      throw new BadRequestException(
        `TransiciÃ³n invÃ¡lida: no se puede cambiar de "${STATUS_LABELS[currentStatus]}" a "${STATUS_LABELS[newStatus]}". ` +
          `Estados vÃ¡lidos: ${validLabels || 'ninguno (estado final)'}`,
      );
    }

    // Si se marca como completado, guardar quiÃ©n validÃ³
    const updateData: Partial<Project> = { status: newStatus };
    if (newStatus === ProjectStatus.COMPLETED) {
      updateData.validatedBy = user.id;
    }

    await this.projectsRepo.update(id, updateData);

    // Registrar en auditorÃ­a
    await this.activityService.logActivity(
      user,
      ActivityAction.PROJECT_STATUS_CHANGE,
      {
        projectId: id,
        projectTitle: project.title,
        previousStatus: currentStatus,
        newStatus: newStatus,
      },
    );

    return this.findOne(id);
  }

  /**
   * Obtiene los estados a los que puede transicionar un proyecto
   */
  getAvailableTransitions(id: string): Promise<{
    currentStatus: ProjectStatus;
    availableStates: ProjectStatus[];
  }> {
    return this.findOne(id).then((project) => ({
      currentStatus: project.status,
      availableStates: getNextValidStates(project.status),
    }));
  }

  async getActivity(projectId: string) {
    return this.activityService.findByProject(projectId);
  }
}


