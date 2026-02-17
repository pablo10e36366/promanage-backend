import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';

import { Project } from '../../../projects/infrastructure/entities/project.entity';
import {
  AccessStatus,
  ProjectAccess,
} from '../../../project-access/infrastructure/entities/project-access.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { Milestone, MilestoneStatus } from '../../../milestones/infrastructure/entities/milestone.entity';
import { Evidence, EvidenceStatus, EvidenceType } from '../../../evidences/infrastructure/entities/evidence.entity';
import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { ActivityFeedEvent } from '../../infrastructure/entities/activity-feed-event.entity';
import { AssignmentStatus } from '../../../assignments/domain/assignment-status';

type CreateTeacherActivityArgs = {
  teacherId: number;
  courseId: string;
  title: string;
  description?: string | null;
  type?: string | null;
  deadline?: string | null;
};

type DeleteTeacherActivityArgs = {
  teacherId: number;
  courseId: string;
  activityId: string;
};

@Injectable()
export class TeacherActivitiesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ProjectAccess)
    private readonly accessRepo: Repository<ProjectAccess>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Milestone)
    private readonly milestonesRepo: Repository<Milestone>,
    @InjectRepository(Evidence)
    private readonly evidencesRepo: Repository<Evidence>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
  ) {}

  async createActivity(args: CreateTeacherActivityArgs) {
    const course = await this.projectsRepo.findOne({
      where: { id: args.courseId },
      relations: ['owner'],
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (course.owner?.id !== args.teacherId) {
      throw new ForbiddenException('No tienes acceso a este curso');
    }

    const teacher = await this.usersRepo.findOne({ where: { id: args.teacherId }, relations: ['role'] });
    if (!teacher) throw new NotFoundException('Docente no encontrado');

    const rawTitle = (args.title || '').trim();
    const title = rawTitle.length > 0 ? rawTitle : 'Actividad';
    const description = (args.description || '').trim() || null;
    const parsedDeadline = args.deadline ? new Date(args.deadline) : null;

    if (args.deadline && Number.isNaN(parsedDeadline?.getTime())) {
      throw new BadRequestException('La fecha lÃ­mite no es vÃ¡lida');
    }
    if (parsedDeadline && parsedDeadline.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha lÃ­mite debe ser futura');
    }

    return this.dataSource.transaction(async (manager) => {
      // Crear milestone (actividad)
      const maxOrderRow = await manager
        .getRepository(Milestone)
        .createQueryBuilder('m')
        .select('MAX(m.order)', 'max')
        .innerJoin('m.project', 'p')
        .where('p.id = :courseId', { courseId: args.courseId })
        .getRawOne<{ max: string | null }>();

      const nextOrder = (Number(maxOrderRow?.max) || 0) + 1;

      const milestoneRepo = manager.getRepository(Milestone);
      const savedMilestone = await milestoneRepo.save(
        milestoneRepo.create({
          title,
          description: description ?? undefined,
          order: nextOrder,
          dueDate: parsedDeadline,
          status: MilestoneStatus.PENDING,
          project: course,
        } as Partial<Milestone>),
      );

      // Crear carpeta en evidences asociada a este milestone
      const evidenceRepo = manager.getRepository(Evidence);
      const savedFolder = await evidenceRepo.save(
        evidenceRepo.create({
          title,
          description: description || undefined,
          isFolder: true,
          mimeType: 'application/vnd.promanage.folder',
          parentId: null,
          type: EvidenceType.FILE,
          status: EvidenceStatus.SUBMITTED,
          milestone: savedMilestone,
          author: teacher,
        } as Partial<Evidence>),
      );

      // Crear assignments pendientes para cada estudiante aprobado del curso (colaboradores)
      // NOTE: se usa SQL directo para evitar inconsistencias de TypeORM con filtros por relaciones en algunos entornos.
      const studentIdRows: Array<{ id: number }> = await manager.query(
        `
          SELECT DISTINCT u.id as id
          FROM project_access pa
          INNER JOIN users u ON u.id = pa.user_id
          LEFT JOIN roles r ON r.id = u.role_id
          WHERE pa.project_id = $1
            AND pa.status = $2
            AND u.id <> $3
            AND COALESCE(LOWER(r.name::text), '') = 'colaborador'
        `,
        [args.courseId, AccessStatus.APPROVED, args.teacherId],
      );

      const studentIds = studentIdRows
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      const createdAssignments: Assignment[] = [];
      for (const studentId of studentIds) {
        const assignmentRepo = manager.getRepository(Assignment);
        createdAssignments.push(
          assignmentRepo.create({
            projectId: args.courseId,
            milestoneId: savedMilestone.id,
            studentId,
            evidenceId: null,
            status: AssignmentStatus.PENDIENTE,
            deadline: parsedDeadline,
            isLate: false,
            feedback: null,
            submittedAt: null,
          } as Partial<Assignment>),
        );
      }

      if (createdAssignments.length) {
        await manager.getRepository(Assignment).save(createdAssignments);
      }

      // Emitir evento al feed del docente
      await manager.getRepository(ActivityFeedEvent).insert({
        teacherId: args.teacherId,
        courseId: args.courseId,
        type: 'announcement_created',
        actorType: 'teacher',
        actorId: args.teacherId,
        actorName: teacher.name || teacher.email,
        entityId: savedMilestone.id,
        title: `Nueva actividad: ${title}`,
        metadata: {
          activityType: args.type ?? null,
          milestoneId: savedMilestone.id,
          folderId: savedFolder.id,
          assignmentsCreated: createdAssignments.length,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
        },
      } as any);

      return {
        milestone_id: savedMilestone.id,
        folder_id: savedFolder.id,
        assignments_created: createdAssignments.length,
        deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
      };
    });
  }

  async deleteActivity(args: DeleteTeacherActivityArgs) {
    const course = await this.projectsRepo.findOne({
      where: { id: args.courseId },
      relations: ['owner'],
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (course.owner?.id !== args.teacherId) {
      throw new ForbiddenException('No tienes acceso a este curso');
    }

    const loadMilestoneFromId = async (id: string) =>
      this.milestonesRepo.findOne({
        where: { id } as any,
        relations: ['project'],
      });

    let milestone = await loadMilestoneFromId(args.activityId);

    if (!milestone || milestone.project?.id !== args.courseId) {
      const sourceEvent = await this.feedRepo.findOne({
        where: {
          id: args.activityId,
          teacherId: args.teacherId,
          courseId: args.courseId,
        } as any,
      });

      const eventMetadata = (sourceEvent?.metadata || null) as Record<string, unknown> | null;
      const fallbackMilestoneId =
        (typeof sourceEvent?.entityId === 'string' && sourceEvent.entityId.trim().length > 0
          ? sourceEvent.entityId
          : null) ||
        (typeof eventMetadata?.milestoneId === 'string' && eventMetadata.milestoneId.trim().length > 0
          ? eventMetadata.milestoneId
          : null) ||
        (typeof eventMetadata?.milestone_id === 'string' && eventMetadata.milestone_id.trim().length > 0
          ? eventMetadata.milestone_id
          : null);

      if (fallbackMilestoneId) {
        milestone = await loadMilestoneFromId(fallbackMilestoneId);
      }
    }

    if (!milestone || milestone.project?.id !== args.courseId) {
      throw new NotFoundException('Actividad no encontrada');
    }

    return this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(Assignment);
      const rows = await assignmentRepo.find({
        select: ['id'],
        where: {
          projectId: args.courseId,
          milestoneId: milestone.id,
        } as any,
      });
      const assignmentIds = rows.map((row) => row.id);
      const assignmentIdsText = assignmentIds.map((id) => String(id));
      const activityIdText = String(milestone.id);

      if (assignmentIds.length) {
        await assignmentRepo.delete({
          projectId: args.courseId,
          milestoneId: milestone.id,
        } as any);
      }

      await manager
        .createQueryBuilder()
        .delete()
        .from(ActivityFeedEvent)
        .where('"teacherId" = :teacherId', { teacherId: args.teacherId })
        .andWhere('"courseId" = :courseId', { courseId: args.courseId })
        .andWhere(
          new Brackets((qb) => {
            qb.where('"entityId" = :activityIdUuid', { activityIdUuid: milestone.id }).orWhere(
              `metadata::jsonb ->> 'milestoneId' = :activityIdText`,
              { activityIdText },
            ).orWhere(
              `metadata::jsonb ->> 'milestone_id' = :activityIdText`,
              { activityIdText },
            );
            if (assignmentIds.length) {
              qb.orWhere('"entityId" IN (:...assignmentIdsUuid)', { assignmentIdsUuid: assignmentIds }).orWhere(
                `metadata::jsonb ->> 'assignmentId' IN (:...assignmentIdsText)`,
                { assignmentIdsText },
              );
            }
          }),
        )
        .execute();

      await manager.getRepository(Milestone).delete({ id: milestone.id } as any);

      return {
        deleted: true as const,
        removed_assignments: assignmentIds.length,
      };
    });
  }
}

