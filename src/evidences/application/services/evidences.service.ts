import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Evidence } from '../../infrastructure/entities/evidence.entity';
import { EvidenceStatus, EvidenceType } from '../../domain/evidence.enums';
import type {
  CreateEvidenceInput,
  ReviewEvidenceInput,
  CreateFileInput,
  CreateFolderInput,
  UpdateContentInput,
  EvidenceDownloadInfo,
} from '../../domain/evidence.types';
import { Milestone, MilestoneStatus } from '../../../milestones/infrastructure/entities/milestone.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { ActivityService } from '../../../activity/application/services/activity.service';
import { ActivityAction } from '../../../activity/infrastructure/entities/activity-log.entity';
import { AssignmentsService } from '../../../assignments/application/services/assignments.service';
import { AssignmentStatus } from '../../../assignments/domain/assignment-status';
import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { ActivityFeedEvent } from '../../../teacher/infrastructure/entities/activity-feed-event.entity';
import type { Multer } from 'multer';

@Injectable()
export class EvidencesService {
  private readonly LOCK_TTL_SECONDS = 30;

  constructor(
    @InjectRepository(Evidence)
    private readonly evidencesRepo: Repository<Evidence>,
    @InjectRepository(Milestone)
    private readonly milestonesRepo: Repository<Milestone>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    private readonly activityService: ActivityService,
    private readonly assignmentsService: AssignmentsService,
    private readonly dataSource: DataSource,
  ) {}

  // --- LÃ“GICA DE CARPETAS (FILE SYSTEM) ---

  private async getOrCreateDefaultMilestone(projectId: string): Promise<Milestone> {
    const existing = await this.milestonesRepo.findOne({
      where: { project: { id: projectId } },
      relations: ['project'],
      order: { order: 'ASC' as any },
    });
    if (existing) return existing;

    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const milestone = new Milestone();
    milestone.title = 'General';
    milestone.description = 'Repositorio general del proyecto';
    milestone.order = 1;
    milestone.dueDate = null as any;
    milestone.status = MilestoneStatus.PENDING;
    milestone.project = project;

    return this.milestonesRepo.save(milestone);
  }

  async createFolder(dto: CreateFolderInput, user: User): Promise<Evidence> {
    const project = await this.projectsRepo.findOne({
      where: { id: dto.projectId },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    if (dto.parentId) {
      const parent = await this.evidencesRepo.findOne({
        where: {
          id: dto.parentId,
          milestone: { project: { id: dto.projectId } },
        },
        relations: ['milestone', 'milestone.project'],
      });
      if (!parent) {
        throw new ForbiddenException('La carpeta padre no pertenece a este proyecto');
      }
      if (!parent.isFolder) {
        throw new BadRequestException('El parentId debe ser una carpeta');
      }
    }

    const folder = new Evidence();
    folder.title = dto.name;
    const description = dto.description?.trim();
    if (description) {
      folder.description = description;
    }
    folder.isFolder = true;
    folder.mimeType = 'application/vnd.promanage.folder';
    folder.parentId = dto.parentId || undefined;
    folder.type = EvidenceType.FILE;
    folder.status = EvidenceStatus.SUBMITTED;
    folder.author = user;

    folder.milestone = await this.getOrCreateDefaultMilestone(dto.projectId);

    return this.evidencesRepo.save(folder);
  }

  async createFile(
    dto: CreateFileInput,
    uploadedFile: Multer.File,
    user: User,
  ): Promise<Evidence> {
    const projectExists = await this.projectsRepo.exists({
      where: { id: dto.projectId },
    });
    if (!projectExists) throw new NotFoundException('Proyecto no encontrado');

    if (dto.parentId) {
      const parent = await this.evidencesRepo.findOne({
        where: {
          id: dto.parentId,
          milestone: { project: { id: dto.projectId } },
        },
        relations: ['milestone', 'milestone.project'],
      });
      if (!parent) {
        throw new ForbiddenException('La carpeta padre no pertenece a este proyecto');
      }
      if (!parent.isFolder) {
        throw new BadRequestException('El parentId debe ser una carpeta');
      }
    }

    const evidence = new Evidence();
    evidence.title =
      dto.name && dto.name.trim() ? dto.name.trim() : uploadedFile.originalname;
    evidence.isFolder = false;
    evidence.mimeType = uploadedFile.mimetype || 'application/octet-stream';
    evidence.contentBlob = null;
    evidence.url = uploadedFile.filename; // storage key (local filename)
    evidence.parentId = dto.parentId || undefined;
    evidence.type = EvidenceType.FILE;
    evidence.status = EvidenceStatus.SUBMITTED;
    evidence.author = user;

    const roleStr = String((user as any)?.role || '').toLowerCase();
    const shouldRegisterStudentSubmission = roleStr === 'colaborador' && Boolean(dto.milestoneId);

    let milestoneTitle: string | null = null;
    if (dto.milestoneId) {
      const milestone = await this.milestonesRepo.findOne({
        where: {
          id: dto.milestoneId,
          project: { id: dto.projectId },
        },
        relations: ['project'],
      });
      if (!milestone) {
        throw new BadRequestException('El milestoneId no pertenece a este proyecto');
      }
      milestoneTitle = milestone.title || null;
      evidence.milestone = milestone;
    } else {
      evidence.milestone = await this.getOrCreateDefaultMilestone(dto.projectId);
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      let assignment: Assignment | null = null;
      let submissionDate: Date | null = null;

      if (shouldRegisterStudentSubmission && dto.milestoneId) {
        const assignmentRepo = manager.getRepository(Assignment);
        assignment = await assignmentRepo.findOne({
          where: {
            projectId: dto.projectId,
            milestoneId: dto.milestoneId,
            studentId: (user as any).id,
          } as any,
        });

        if (assignment) {
          submissionDate = new Date();
          if (
            assignment.deadline != null &&
            assignment.deadline.getTime() < submissionDate.getTime()
          ) {
            throw new BadRequestException('La fecha lÃ­mite de esta actividad ya venciÃ³');
          }
        }
      }

      const savedEvidence = await manager.getRepository(Evidence).save(evidence);

      if (assignment && submissionDate) {
        assignment.evidenceId = savedEvidence.id;
        assignment.status = AssignmentStatus.ENTREGADO;
        assignment.submittedAt = submissionDate;
        assignment.isLate = false;

        await manager.getRepository(Assignment).save(assignment);

        const course = await manager.getRepository(Project).findOne({
          where: { id: dto.projectId } as any,
          relations: ['owner'],
        });
        const teacherId = course?.owner?.id;
        if (teacherId) {
          await manager.getRepository(ActivityFeedEvent).insert({
            teacherId,
            courseId: dto.projectId,
            type: 'submission_created',
            actorType: 'student',
            actorId: (user as any).id,
            actorName: (user as any).name || (user as any).email || null,
            entityId: assignment.id,
            title: `Entrega recibida: ${milestoneTitle || 'Actividad'}`,
            metadata: {
              assignmentId: assignment.id,
              evidenceId: savedEvidence.id,
              milestoneId: dto.milestoneId,
              fileName: savedEvidence.title,
            },
          } as any);
        }
      }

      return savedEvidence;
    });
    try {
      await this.activityService.logActivity(user, ActivityAction.FILE_UPLOAD, {
        evidenceId: saved.id,
        fileName: saved.title,
        projectId: dto.projectId,
      });
    } catch (err: any) {
      // No bloquear la subida si el esquema de auditorÃ­a (enum) estÃ¡ desactualizado en la BD.
      console.error(
        '[WARN] No se pudo registrar activity FILE_UPLOAD:',
        err?.message || err,
      );
    }
    return saved;
  }

  async getStudentFilesByActivity(
    projectId: string,
  ): Promise<
    Array<{
      activityId: string | null;
      activityTitle: string;
      files: Evidence[];
    }>
  > {
    const projectExists = await this.projectsRepo.exists({
      where: { id: projectId },
    });
    if (!projectExists) throw new NotFoundException('Proyecto no encontrado');

    const excludedRoles = [
      'admin',
      'docente',
      'professor',
      'mentor',
      'usuario',
      'user',
    ];

    const groups = new Map<
      string,
      { activityId: string | null; activityTitle: string; files: Evidence[] }
    >();

    // Prefill con carpetas raiz (actividades), incluso si no tienen evidencias aun.
    const rootFolders = await this.evidencesRepo
      .createQueryBuilder('f')
      .innerJoin('f.milestone', 'm')
      .innerJoin('m.project', 'p', 'p.id = :projectId', { projectId })
      .where('f.isFolder = true')
      .andWhere('f.parentId IS NULL')
      .orderBy('f.title', 'ASC')
      .getMany();

    for (const folder of rootFolders) {
      const activityId = folder.id;
      const activityTitle = folder.title || 'Sin actividad';
      groups.set(activityId, { activityId, activityTitle, files: [] });
    }

    const evidences = await this.evidencesRepo
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.milestone', 'm')
      .innerJoinAndSelect('m.project', 'p', 'p.id = :projectId', { projectId })
      .leftJoinAndSelect('e.author', 'author')
      .leftJoinAndSelect('author.role', 'role')
      .leftJoinAndSelect('e.parent', 'parent')
      .where('e.isFolder = false')
      .andWhere('e.type = :fileType', { fileType: EvidenceType.FILE })
      .andWhere('e.url IS NOT NULL')
      .andWhere("LOWER(COALESCE(role.name, '')) NOT IN (:...excludedRoles)", {
        excludedRoles,
      })
      .orderBy('parent.title', 'ASC')
      .addOrderBy('e.createdAt', 'DESC')
      .getMany();

    for (const ev of evidences) {
      const activityId = ev.parent?.id || null;
      const activityTitle = ev.parent?.title || 'Sin actividad';
      const key = activityId || 'none';
      const current = groups.get(key);
      if (current) {
        current.files.push(ev);
      } else {
        groups.set(key, {
          activityId,
          activityTitle,
          files: [ev],
        });
      }
    }

    const result = Array.from(groups.values());
    result.sort((a, b) => {
      if (a.activityTitle === 'Sin actividad') return 1;
      if (b.activityTitle === 'Sin actividad') return -1;
      return a.activityTitle.localeCompare(b.activityTitle, 'es', {
        sensitivity: 'base',
      });
    });
    return result;
  }

  async searchMyFiles(
    query: string | undefined,
    user: User,
  ): Promise<
    Array<{
      id: string;
      title: string | null;
      mimeType: string | null;
      updatedAt: Date;
      projectId: string;
      projectTitle: string | null;
    }>
  > {
    const trimmed = (query || '').trim();
    const qb = this.evidencesRepo
      .createQueryBuilder('e')
      .innerJoin('e.author', 'author')
      .innerJoin('e.milestone', 'milestone')
      .innerJoin('milestone.project', 'project')
      .select('e.id', 'id')
      .addSelect('e.title', 'title')
      .addSelect('e.mimeType', 'mimeType')
      .addSelect('e.updatedAt', 'updatedAt')
      .addSelect('project.id', 'projectId')
      .addSelect('project.title', 'projectTitle')
      .where('author.id = :userId', { userId: user.id })
      .andWhere('e.isFolder = false')
      .andWhere('e.type = :fileType', { fileType: EvidenceType.FILE })
      .andWhere('e.url IS NOT NULL')
      .orderBy('e.updatedAt', 'DESC')
      .limit(20);

    if (trimmed.length > 0) {
      qb.andWhere('(e.title ILIKE :q OR project.title ILIKE :q)', {
        q: `%${trimmed}%`,
      });
    }

    return qb.getRawMany();
  }

  async getDownloadInfo(id: string, user: User): Promise<EvidenceDownloadInfo> {
    const evidence = await this.evidencesRepo.findOne({
      where: { id },
      relations: ['author', 'milestone', 'milestone.project', 'milestone.project.owner'],
    });
    if (!evidence) throw new NotFoundException('Archivo no encontrado');
    if (evidence.isFolder) {
      throw new BadRequestException('No se puede descargar una carpeta');
    }
    if (!evidence.url) {
      throw new NotFoundException('Este archivo no tiene contenido adjunto.');
    }

    const isAdmin = user.role?.name
      ? String(user.role.name).toLowerCase() === 'admin'
      : false;
    const isOwner = evidence.milestone?.project?.owner?.id === user.id;
    const isAuthor = evidence.author?.id === user.id;
    if (!isAdmin && !isOwner && !isAuthor) {
      throw new ForbiddenException('No tienes permiso para descargar este archivo');
    }

    const filePath = join(process.cwd(), 'uploads', 'evidences', evidence.url);

    const safeNameBase = (evidence.title || 'documento')
      .replace(/[\\\/:*?"<>|]+/g, '_')
      .trim();
    const safeName = safeNameBase.length > 0 ? safeNameBase : 'documento';

    return {
      filePath,
      mimeType: evidence.mimeType || 'application/octet-stream',
      dispositionFilename: safeName,
    };
  }

  async getFolderContents(
    projectId: string,
    folderId: string | null,
  ): Promise<Evidence[]> {
    const projectExists = await this.projectsRepo.exists({
      where: { id: projectId },
    });
    if (!projectExists) throw new NotFoundException('Proyecto no encontrado');

    if (folderId) {
      const parent = await this.evidencesRepo.findOne({
        where: { id: folderId },
      });
      if (!parent) throw new NotFoundException('Carpeta padre no encontrada');
    }

    const whereCondition: any = {
      milestone: { project: { id: projectId } },
    };

    if (folderId) {
      whereCondition.parentId = folderId;
    } else {
      whereCondition.parentId = IsNull();
    }

    return this.evidencesRepo.find({
      where: whereCondition,
      relations: ['author'],
      order: { title: 'ASC' },
    });
  }

  // --- LÃ“GICA DE LOCKING (SEMÃFORO) ---

  async acquireLock(
    evidenceId: string,
    user: User,
  ): Promise<{ success: boolean; message: string; expiresAt?: Date }> {
    const evidence = await this.evidencesRepo.findOne({
      where: { id: evidenceId },
      relations: ['lockUser'],
    });

    if (!evidence) throw new NotFoundException('Archivo no encontrado');

    const now = new Date();

    // Caso 1: No hay lock
    if (!evidence.lockUserId) {
      evidence.lockUserId = user.id;
      evidence.lockExpiresAt = new Date(
        now.getTime() + this.LOCK_TTL_SECONDS * 1000,
      );
      await this.evidencesRepo.save(evidence);
      return {
        success: true,
        message: 'Lock adquirido',
        expiresAt: evidence.lockExpiresAt,
      };
    }

    // Caso 2: Lock del mismo usuario (renovar)
    if (evidence.lockUserId === user.id) {
      evidence.lockExpiresAt = new Date(
        now.getTime() + this.LOCK_TTL_SECONDS * 1000,
      );
      await this.evidencesRepo.save(evidence);
      return {
        success: true,
        message: 'Lock renovado',
        expiresAt: evidence.lockExpiresAt,
      };
    }

    // Caso 3: Lock activo de otro usuario
    if (evidence.lockExpiresAt && evidence.lockExpiresAt > now) {
      return {
        success: false,
        message: `Bloqueado por ${evidence.lockUser?.name || 'otro usuario'}`,
      };
    }

    // Caso 4: Lock vencido (Robar)
    evidence.lockUserId = user.id;
    evidence.lockExpiresAt = new Date(now.getTime() + this.LOCK_TTL_SECONDS * 1000);
    await this.evidencesRepo.save(evidence);
    return {
      success: true,
      message: 'Lock robado (expirÃ³)',
      expiresAt: evidence.lockExpiresAt,
    };
  }

  async releaseLock(
    evidenceId: string,
    user: User,
  ): Promise<{ success: boolean }> {
    const evidence = await this.evidencesRepo.findOne({
      where: { id: evidenceId },
    });
    if (!evidence) throw new NotFoundException('Archivo no encontrado');

    if (evidence.lockUserId && evidence.lockUserId !== user.id) {
      throw new ForbiddenException('No puedes liberar el lock de otro usuario');
    }

    evidence.lockUserId = undefined;
    evidence.lockExpiresAt = undefined;
    await this.evidencesRepo.save(evidence);

    return { success: true };
  }

  async saveContent(
    id: string,
    dto: UpdateContentInput,
    user: User,
  ): Promise<Evidence> {
    const evidence = await this.evidencesRepo.findOne({
      where: { id },
      relations: ['lockUser'],
    });

    if (!evidence) throw new NotFoundException('Archivo no encontrado');

    // Verificar lock
    if (!evidence.lockUserId || evidence.lockUserId !== user.id) {
      throw new ConflictException('No tienes el lock activo. Guarda la conexiÃ³n.');
    }

    // Verificar expiraciÃ³n
    if (evidence.lockExpiresAt && evidence.lockExpiresAt < new Date()) {
      throw new ConflictException('Tu lock ha expirado.');
    }

    evidence.contentBlob = dto.content;
    // No liberamos el lock al guardar, el cliente debe seguir escribiendo
    // o enviar releaseLock al cerrar

    return this.evidencesRepo.save(evidence);
  }

  // --- LÃ“GICA EXISTENTE (MANTENIDA) ---

  async submit(createEvidenceDto: CreateEvidenceInput, user: User): Promise<Evidence> {
    // Iniciar transacciÃ³n
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const milestone = await this.milestonesRepo.findOne({
        where: { id: createEvidenceDto.milestoneId },
        relations: ['project'],
      });

      if (!milestone) {
        throw new NotFoundException(
          `Hito con ID ${createEvidenceDto.milestoneId} no encontrado`,
        );
      }

      const evidence = new Evidence();
      evidence.title = createEvidenceDto.title;
      evidence.type = createEvidenceDto.type;
      evidence.url = createEvidenceDto.url;
      evidence.description = createEvidenceDto.description;

      // Soporte legacy/nuevos campos
      evidence.isFolder = false;
      evidence.mimeType = createEvidenceDto.mimeType;
      evidence.contentBlob = createEvidenceDto.contentBlob || null;
      evidence.parentId = createEvidenceDto.parentId || null;

      evidence.status = EvidenceStatus.SUBMITTED;
      evidence.author = user;
      evidence.milestone = milestone;

      const savedEvidence = await queryRunner.manager.save(evidence);

      // Si se proporcionÃ³ assignmentId, asociar y cambiar estado a ENTREGADO
      if (createEvidenceDto.assignmentId) {
        // Buscar assignment dentro de la transacciÃ³n
        const assignment = await queryRunner.manager.findOne(Assignment, {
          where: { id: createEvidenceDto.assignmentId },
          relations: ['project', 'student'],
        });

        if (!assignment) {
          throw new NotFoundException(
            `Assignment con ID ${createEvidenceDto.assignmentId} no encontrado`,
          );
        }

        // Verificar que el usuario sea el estudiante asignado o tenga permisos
        if (assignment.studentId !== user.id) {
          throw new ForbiddenException(
            'Solo el estudiante asignado puede subir evidencias para este assignment',
          );
        }

        // Validar transiciÃ³n de estado (de PENDIENTE a ENTREGADO)
        if (assignment.status !== AssignmentStatus.PENDIENTE) {
          throw new BadRequestException(
            `El assignment ya estÃ¡ en estado ${assignment.status}, no se puede marcar como ENTREGADO`,
          );
        }

        // Actualizar assignment: estado ENTREGADO, evidenceId y submittedAt
        assignment.status = AssignmentStatus.ENTREGADO;
        assignment.evidenceId = savedEvidence.id;
        assignment.submittedAt = new Date();
        assignment.updatedAt = new Date();

        await queryRunner.manager.save(assignment);
      }

      await this.activityService.logActivity(user, ActivityAction.SUBMIT_EVIDENCE, {
        evidenceId: savedEvidence.id,
        milestoneId: milestone.id,
      });

      const evidenceCount = await queryRunner.manager.count(Evidence, {
        where: { milestone: { id: milestone.id } },
      });

      if (evidenceCount === 1 && milestone.status === MilestoneStatus.PENDING) {
        milestone.status = MilestoneStatus.IN_PROGRESS;
        await queryRunner.manager.save(milestone);
      }

      // Commit de la transacciÃ³n
      await queryRunner.commitTransaction();
      return savedEvidence;
    } catch (error) {
      // Rollback en caso de error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Liberar query runner
      await queryRunner.release();
    }
  }

  async review(
    evidenceId: string,
    reviewEvidenceDto: ReviewEvidenceInput,
    user: User,
  ): Promise<Evidence> {
    const evidence = await this.evidencesRepo.findOne({
      where: { id: evidenceId },
      relations: ['milestone', 'milestone.project', 'milestone.project.owner'],
    });

    if (!evidence) {
      throw new NotFoundException(`Evidencia con ID ${evidenceId} no encontrada`);
    }

    if (evidence.milestone.project.owner.id !== user.id) {
      throw new ForbiddenException('Solo el dueÃ±o del proyecto puede calificar evidencias');
    }

    evidence.status = reviewEvidenceDto.status;
    evidence.feedback = reviewEvidenceDto.feedback || null;

    const updatedEvidence = await this.evidencesRepo.save(evidence);

    await this.activityService.logActivity(user, ActivityAction.REVIEW_EVIDENCE, {
      evidenceId: updatedEvidence.id,
      status: reviewEvidenceDto.status,
    });

    if (reviewEvidenceDto.status === EvidenceStatus.APPROVED) {
      evidence.milestone.status = MilestoneStatus.COMPLETED;
      await this.milestonesRepo.save(evidence.milestone);
    }

    return updatedEvidence;
  }

  async findAllByMilestone(milestoneId: string): Promise<Evidence[]> {
    return this.evidencesRepo.find({
      where: { milestone: { id: milestoneId } },
      relations: ['author', 'milestone'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Evidence> {
    const evidence = await this.evidencesRepo.findOne({
      where: { id },
      relations: ['author', 'milestone', 'milestone.project'],
    });
    if (!evidence) {
      throw new NotFoundException(`Evidencia con ID ${id} no encontrada`);
    }
    return evidence;
  }

  async findOneForUser(id: string, user: User): Promise<Evidence> {
    const evidence = await this.evidencesRepo.findOne({
      where: { id },
      relations: ['author', 'milestone', 'milestone.project', 'milestone.project.owner'],
    });
    if (!evidence) {
      throw new NotFoundException(`Evidencia con ID ${id} no encontrada`);
    }

    const roleName = user.role?.name ? String(user.role.name).toLowerCase() : '';
    const isAdmin = roleName === 'admin';
    const isOwner = evidence.milestone?.project?.owner?.id === user.id;
    const isAuthor = evidence.author?.id === user.id;

    if (!isAdmin && !isOwner && !isAuthor) {
      throw new ForbiddenException('No tienes permiso para ver esta evidencia');
    }

    return evidence;
  }
}

