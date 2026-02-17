import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Assignment } from '../../infrastructure/entities/assignment.entity';
import { AssignmentStatus, isValidAssignmentTransition } from '../../domain/assignment-status';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { ReviewAssignmentDto } from '../dto/review-assignment.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { Milestone } from '../../../milestones/infrastructure/entities/milestone.entity';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';
import { ActivityFeedEvent } from '../../../teacher/infrastructure/entities/activity-feed-event.entity';
import { CourseStats } from '../../../teacher/infrastructure/entities/course-stats.entity';
import { SubmissionReview } from '../../../teacher/infrastructure/entities/submission-review.entity';
import { TeacherStats } from '../../../teacher/infrastructure/entities/teacher-stats.entity';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Milestone)
    private readonly milestonesRepo: Repository<Milestone>,
    @InjectRepository(Evidence)
    private readonly evidencesRepo: Repository<Evidence>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
    @InjectRepository(CourseStats)
    private readonly courseStatsRepo: Repository<CourseStats>,
    @InjectRepository(TeacherStats)
    private readonly teacherStatsRepo: Repository<TeacherStats>,
    @InjectRepository(SubmissionReview)
    private readonly submissionReviewsRepo: Repository<SubmissionReview>,
  ) {}

  /**
   * Crea una nueva entrega (assignment)
   */
  async create(createDto: CreateAssignmentDto, user: User): Promise<Assignment> {
    // Validar que el proyecto exista
    const project = await this.projectsRepo.findOne({
      where: { id: createDto.projectId },
      relations: ['owner'],
    });
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${createDto.projectId} no encontrado`);
    }
    if (!project.owner?.id) {
      throw new NotFoundException('Proyecto sin profesor asignado');
    }

    // Validar que el estudiante exista
    const student = await this.usersRepo.findOne({
      where: { id: createDto.studentId },
    });
    if (!student) {
      throw new NotFoundException(`Estudiante con ID ${createDto.studentId} no encontrado`);
    }

    // Si se proporciona milestoneId, validar que exista
    let milestone: Milestone | null = null;
    if (createDto.milestoneId) {
      milestone = await this.milestonesRepo.findOne({
        where: { id: createDto.milestoneId },
      });
      if (!milestone) {
        throw new NotFoundException(`Hito con ID ${createDto.milestoneId} no encontrado`);
      }
    }

    // Si se proporciona evidenceId, validar que exista
    let evidence: Evidence | null = null;
    if (createDto.evidenceId) {
      evidence = await this.evidencesRepo.findOne({
        where: { id: createDto.evidenceId },
      });
      if (!evidence) {
        throw new NotFoundException(`Evidencia con ID ${createDto.evidenceId} no encontrada`);
      }
    }

    // Calcular isLate si hay deadline y submittedAt
    let isLate = false;
    const submittedAt = createDto.status === AssignmentStatus.ENTREGADO ? new Date() : null;
    if (createDto.deadline && submittedAt) {
      const deadlineDate = new Date(createDto.deadline);
      if (submittedAt > deadlineDate) {
        throw new BadRequestException('La fecha límite de esta actividad ya venció');
      }
      isLate = false;
    }

    return await this.dataSource.transaction(async (manager) => {
      const assignment = manager.getRepository(Assignment).create({
        projectId: createDto.projectId,
        milestoneId: createDto.milestoneId || null,
        studentId: createDto.studentId,
        evidenceId: createDto.evidenceId || null,
        status: createDto.status || AssignmentStatus.PENDIENTE,
        deadline: createDto.deadline ? new Date(createDto.deadline) : null,
        isLate,
        feedback: createDto.feedback || null,
        submittedAt,
      });

      const saved = await manager.getRepository(Assignment).save(assignment);

      // If this is created already submitted, emit feed + update stats.
      if (saved.status === AssignmentStatus.ENTREGADO) {
        await this.ensureStatsRows(manager, project.id, project.owner.id);
        await this.bumpPendingSubmissionCounters(manager, project.id, project.owner.id, saved.deadline);

        await manager.getRepository(ActivityFeedEvent).insert({
          teacherId: project.owner.id,
          courseId: project.id,
          type: 'submission_created',
          actorType: 'student',
          actorId: student.id,
          actorName: student.name || student.email,
          entityId: saved.id,
          title: 'Nueva entrega',
          metadata: { submissionId: saved.id, evidenceId: saved.evidenceId },
        } as any);
      }

      return saved;
    });
  }

  /**
   * Lista todas las entregas de un proyecto
   */
  async findByProject(projectId: string, user: User): Promise<Assignment[]> {
    // Verificar que el proyecto exista y que el usuario tenga acceso (simplificado)
    const project = await this.projectsRepo.findOne({
      where: { id: projectId },
      relations: ['owner'],
    });
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    // Permiso básico: solo owner o admin pueden ver las entregas
    const isOwner = project.owner.id === user.id;
    const isAdmin = user.role?.name === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para ver las entregas de este proyecto');
    }

    // Usar query builder para orden personalizado
    return this.assignmentsRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.student', 'student')
      .leftJoinAndSelect('assignment.milestone', 'milestone')
      .leftJoinAndSelect('assignment.evidence', 'evidence')
      .where('assignment.projectId = :projectId', { projectId })
      .orderBy(`
        CASE assignment.status
          WHEN 'PENDIENTE' THEN 1
          WHEN 'ENTREGADO' THEN 2
          WHEN 'REVISADO' THEN 3
          ELSE 4
        END
      `)
      .addOrderBy('assignment.submittedAt', 'DESC')
      .addOrderBy('assignment.createdAt', 'DESC') // Orden secundario por creación
      .getMany();
  }

  /**
   * Obtiene una entrega por ID
   */
  async findOne(id: string, user: User): Promise<Assignment> {
    const assignment = await this.assignmentsRepo.findOne({
      where: { id },
      relations: ['project', 'student', 'milestone', 'evidence'],
    });
    if (!assignment) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada`);
    }

    // Verificar permisos (owner del proyecto o admin)
    const project = await this.projectsRepo.findOne({
      where: { id: assignment.projectId },
      relations: ['owner'],
    });
    const isOwner = project?.owner.id === user.id;
    const isAdmin = user.role?.name === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para ver esta entrega');
    }

    return assignment;
  }

  /**
   * Marca una entrega como REVISADA (con feedback)
   */
  async review(id: string, reviewDto: ReviewAssignmentDto, user: User): Promise<Assignment> {
    const assignment = await this.assignmentsRepo.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!assignment) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada`);
    }

    // No permitir cambios si ya está REVISADO
    if (assignment.status === AssignmentStatus.REVISADO) {
      throw new BadRequestException('La entrega ya está revisada y no puede ser modificada');
    }

    // Verificar que el usuario sea profesor o admin (simplificado: solo admin o owner del proyecto)
    const project = await this.projectsRepo.findOne({
      where: { id: assignment.projectId },
      relations: ['owner'],
    });
    const isOwner = project?.owner.id === user.id;
    const isAdmin = user.role?.name === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Solo el profesor o administrador puede revisar entregas');
    }

    // Validar transición de estado
    if (!isValidAssignmentTransition(assignment.status, AssignmentStatus.REVISADO)) {
      throw new BadRequestException(
        `No se puede marcar como REVISADO desde el estado ${assignment.status}`,
      );
    }

    // Actualizar estado y feedback
    assignment.status = AssignmentStatus.REVISADO;
    assignment.feedback = reviewDto.feedback || assignment.feedback;
    assignment.reviewOutcome = 'APPROVED';
    assignment.reviewedById = user.id;
    assignment.updatedAt = new Date();

    const saved = await this.assignmentsRepo.save(assignment);

    // Stats + feed for teacher task navigation
    if (project?.owner?.id) {
      const teacherId = project.owner.id;
      const isOverdue = !!saved.deadline && saved.deadline.getTime() < Date.now();

      await this.dataSource.transaction(async (manager) => {
        await this.ensureStatsRows(manager, project.id, teacherId);
        await this.decrementPendingSubmissionCounters(manager, project.id, teacherId, isOverdue);

        await manager.getRepository(SubmissionReview).insert({
          submissionId: saved.id,
          teacherId: user.id,
          status: 'approved',
          feedback: saved.feedback || null,
          rubricScores: null,
        } as any);

        await manager.getRepository(ActivityFeedEvent).insert({
          teacherId,
          courseId: project.id,
          type: 'submission_reviewed',
          actorType: user.id === teacherId ? 'teacher' : 'system',
          actorId: user.id,
          actorName: user.name || user.email,
          entityId: saved.id,
          title: 'Entrega revisada',
          metadata: { submissionId: saved.id, outcome: 'approved' },
        } as any);
      });
    }

    return saved;
  }

  /**
   * Cambia el estado de una entrega (por ejemplo, de PENDIENTE a ENTREGADO)
   */
  async changeStatus(
    id: string,
    newStatus: AssignmentStatus,
    user: User,
  ): Promise<Assignment> {
    const assignment = await this.assignmentsRepo.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!assignment) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada`);
    }

    // Verificar permisos (estudiante puede marcar como ENTREGADO, profesor puede cambiar a REVISADO)
    const project = await this.projectsRepo.findOne({
      where: { id: assignment.projectId },
      relations: ['owner'],
    });
    const isOwner = project?.owner.id === user.id;
    const isAdmin = user.role?.name === 'admin';
    const isStudent = assignment.studentId === user.id;

    // Lógica de permisos simplificada
    if (newStatus === AssignmentStatus.ENTREGADO && !isStudent && !isAdmin && !isOwner) {
      throw new ForbiddenException('Solo el estudiante puede marcar como ENTREGADO');
    }
    if (newStatus === AssignmentStatus.REVISADO && !isOwner && !isAdmin) {
      throw new ForbiddenException('Solo el profesor puede marcar como REVISADO');
    }

    // Validar transición
    if (!isValidAssignmentTransition(assignment.status, newStatus)) {
      throw new BadRequestException(
        `Transición inválida de ${assignment.status} a ${newStatus}`,
      );
    }

    const prevStatus = assignment.status;

    // Si se marca como ENTREGADO, establecer submittedAt y recalcular isLate
    if (newStatus === AssignmentStatus.ENTREGADO && !assignment.submittedAt) {
      if (assignment.deadline && assignment.deadline.getTime() < Date.now()) {
        throw new BadRequestException('La fecha límite de esta actividad ya venció');
      }
      assignment.submittedAt = new Date();
      // Recalcular isLate si hay deadline
      if (assignment.deadline) {
        assignment.isLate = assignment.submittedAt > assignment.deadline;
      }
    }

    assignment.status = newStatus;
    assignment.updatedAt = new Date();

    const saved = await this.assignmentsRepo.save(assignment);

    // If the student just submitted, emit feed + update stats for the owner teacher.
    if (prevStatus !== AssignmentStatus.ENTREGADO && newStatus === AssignmentStatus.ENTREGADO) {
      const projectWithOwner = await this.projectsRepo.findOne({
        where: { id: saved.projectId },
        relations: ['owner'],
      });
      if (projectWithOwner?.owner?.id) {
        const teacherId = projectWithOwner.owner.id;
        const student = await this.usersRepo.findOne({ where: { id: saved.studentId } });

        await this.dataSource.transaction(async (manager) => {
          await this.ensureStatsRows(manager, projectWithOwner.id, teacherId);
          await this.bumpPendingSubmissionCounters(manager, projectWithOwner.id, teacherId, saved.deadline);

          await manager.getRepository(ActivityFeedEvent).insert({
            teacherId,
            courseId: projectWithOwner.id,
            type: 'submission_created',
            actorType: 'student',
            actorId: saved.studentId,
            actorName: student?.name || student?.email || null,
            entityId: saved.id,
            title: 'Nueva entrega',
            metadata: { submissionId: saved.id, evidenceId: saved.evidenceId },
          } as any);
        });
      }
    }

    return saved;
  }

  private async ensureStatsRows(manager: any, courseId: string, teacherId: number) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(CourseStats)
      .values({ courseId, teacherId } as any)
      .orIgnore()
      .execute();

    await manager
      .createQueryBuilder()
      .insert()
      .into(TeacherStats)
      .values({ teacherId } as any)
      .orIgnore()
      .execute();
  }

  private async bumpPendingSubmissionCounters(
    manager: any,
    courseId: string,
    teacherId: number,
    deadline: Date | null,
  ) {
    const isOverdue = !!deadline && deadline.getTime() < Date.now();

    if (isOverdue) {
      await manager
        .createQueryBuilder()
        .update(CourseStats)
        .set({
          teacherId,
          pendingSubmissionsCount: () => `"pendingSubmissionsCount" + 1`,
          overdueSubmissionsCount: () => `"overdueSubmissionsCount" + 1`,
          lastActivityAt: () => 'NOW()',
          updatedAt: () => 'NOW()',
        })
        .where('"courseId" = :courseId', { courseId })
        .execute();

      await manager
        .createQueryBuilder()
        .update(TeacherStats)
        .set({
          pendingSubmissionsCount: () => `"pendingSubmissionsCount" + 1`,
          overdueCount: () => `"overdueCount" + 1`,
          updatedAt: () => 'NOW()',
        })
        .where('"teacherId" = :teacherId', { teacherId })
        .execute();
      return;
    }

    await manager
      .createQueryBuilder()
      .update(CourseStats)
      .set({
        teacherId,
        pendingSubmissionsCount: () => `"pendingSubmissionsCount" + 1`,
        lastActivityAt: () => 'NOW()',
        updatedAt: () => 'NOW()',
      })
      .where('"courseId" = :courseId', { courseId })
      .execute();

    await manager
      .createQueryBuilder()
      .update(TeacherStats)
      .set({
        pendingSubmissionsCount: () => `"pendingSubmissionsCount" + 1`,
        updatedAt: () => 'NOW()',
      })
      .where('"teacherId" = :teacherId', { teacherId })
      .execute();
  }

  private async decrementPendingSubmissionCounters(
    manager: any,
    courseId: string,
    teacherId: number,
    isOverdue: boolean,
  ) {
    if (isOverdue) {
      await manager
        .createQueryBuilder()
        .update(CourseStats)
        .set({
          pendingSubmissionsCount: () => `GREATEST("pendingSubmissionsCount" - 1, 0)`,
          overdueSubmissionsCount: () => `GREATEST("overdueSubmissionsCount" - 1, 0)`,
          lastActivityAt: () => 'NOW()',
          updatedAt: () => 'NOW()',
        })
        .where('"courseId" = :courseId', { courseId })
        .execute();

      await manager
        .createQueryBuilder()
        .update(TeacherStats)
        .set({
          pendingSubmissionsCount: () => `GREATEST("pendingSubmissionsCount" - 1, 0)`,
          overdueCount: () => `GREATEST("overdueCount" - 1, 0)`,
          updatedAt: () => 'NOW()',
        })
        .where('"teacherId" = :teacherId', { teacherId })
        .execute();
      return;
    }

    await manager
      .createQueryBuilder()
      .update(CourseStats)
      .set({
        pendingSubmissionsCount: () => `GREATEST("pendingSubmissionsCount" - 1, 0)`,
        lastActivityAt: () => 'NOW()',
        updatedAt: () => 'NOW()',
      })
      .where('"courseId" = :courseId', { courseId })
      .execute();

    await manager
      .createQueryBuilder()
      .update(TeacherStats)
      .set({
        pendingSubmissionsCount: () => `GREATEST("pendingSubmissionsCount" - 1, 0)`,
        updatedAt: () => 'NOW()',
      })
      .where('"teacherId" = :teacherId', { teacherId })
      .execute();
  }

  /**
   * Elimina una entrega (solo admin o profesor)
   */
  async remove(id: string, user: User): Promise<void> {
    const assignment = await this.assignmentsRepo.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!assignment) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada`);
    }

    const project = await this.projectsRepo.findOne({
      where: { id: assignment.projectId },
      relations: ['owner'],
    });
    const isOwner = project?.owner.id === user.id;
    const isAdmin = user.role?.name === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para eliminar esta entrega');
    }

    await this.assignmentsRepo.delete(id);
  }
}


