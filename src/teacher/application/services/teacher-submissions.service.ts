import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';
import { EvidenceStatus, EvidenceType } from '../../../evidences/domain/evidence.enums';
import { CourseStats } from '../../infrastructure/entities/course-stats.entity';
import { TeacherStats } from '../../infrastructure/entities/teacher-stats.entity';
import { ActivityFeedEvent } from '../../infrastructure/entities/activity-feed-event.entity';
import { SubmissionReview } from '../../infrastructure/entities/submission-review.entity';
import { TeacherStatsService } from './stats.service';
import { TeacherSubmissionsQueryDto } from '../dto/teacher-submissions.query.dto';
import { ReviewSubmissionDto } from '../dto/review-submission.dto';

type UnifiedPriority = 'high' | 'medium' | 'low';

function iso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}

const ACCENTED_CHARS = 'áàäâãéèëêíìïîóòöôõúùüûñç';
const UNACCENTED_CHARS = 'aaaaaeeeeiiiiooooouuuunc';

function normalizeSearchTerm(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizedSql(expr: string): string {
  return `REGEXP_REPLACE(TRANSLATE(LOWER(COALESCE(${expr}, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'), '\\s+', ' ', 'g')`;
}

@Injectable()
export class TeacherSubmissionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(SubmissionReview)
    private readonly reviewsRepo: Repository<SubmissionReview>,
    @InjectRepository(ActivityFeedEvent)
    private readonly feedRepo: Repository<ActivityFeedEvent>,
    @InjectRepository(CourseStats)
    private readonly courseStatsRepo: Repository<CourseStats>,
    @InjectRepository(TeacherStats)
    private readonly teacherStatsRepo: Repository<TeacherStats>,
    private readonly statsService: TeacherStatsService,
  ) {}

  async list(teacherId: number, query: TeacherSubmissionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 10;
    const status = query.status ?? 'pending';
    const sort = query.sort ?? 'priority_desc';
    const includeUnsubmitted = query.include_unsubmitted === true;

    const qb = this.assignmentsRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.project', 'course')
      .innerJoin('course.owner', 'teacher')
      .innerJoinAndSelect('s.student', 'student')
      .leftJoinAndSelect('s.evidence', 'evidence')
      .leftJoinAndSelect('evidence.parent', 'evidenceParent')
      .leftJoinAndSelect('evidence.milestone', 'evidenceMilestone')
      .leftJoinAndSelect('s.milestone', 'milestone')
      .where('teacher.id = :teacherId', { teacherId });

    if (query.course_id) {
      qb.andWhere('course.id = :courseId', { courseId: query.course_id });
    }
    if (query.student_id) {
      qb.andWhere('student.id = :studentId', { studentId: query.student_id });
    }
    if (query.q) {
      const rawTerm = query.q.trim().toLowerCase();
      const normalizedTerm = normalizeSearchTerm(query.q);
      const q = `%${rawTerm}%`;
      const q_norm = `%${normalizedTerm}%`;
      qb.andWhere(
        `(
          LOWER(student.name) LIKE :q OR
          LOWER(student.email) LIKE :q OR
          LOWER(course.title) LIKE :q OR
          LOWER(COALESCE(evidence.title, '')) LIKE :q OR
          LOWER(COALESCE(evidenceParent.title, '')) LIKE :q OR
          LOWER(COALESCE(milestone.title, '')) LIKE :q OR
          LOWER(COALESCE(evidenceMilestone.title, '')) LIKE :q OR
          ${normalizedSql('student.name')} LIKE :q_norm OR
          ${normalizedSql('student.email')} LIKE :q_norm OR
          ${normalizedSql('course.title')} LIKE :q_norm OR
          ${normalizedSql('evidence.title')} LIKE :q_norm OR
          ${normalizedSql('evidenceParent.title')} LIKE :q_norm OR
          ${normalizedSql('milestone.title')} LIKE :q_norm OR
          ${normalizedSql('evidenceMilestone.title')} LIKE :q_norm
        )`,
        { q, q_norm },
      );
    }

    // Map normalized LMS statuses to existing workflow
    if (status === 'pending') {
      qb.andWhere('s.status = :workflow', { workflow: 'ENTREGADO' });
    } else if (status === 'approved') {
      qb.andWhere('s.status = :workflow', { workflow: 'REVISADO' });
      qb.andWhere('s.reviewOutcome = :out', { out: 'APPROVED' });
    } else if (status === 'changes_requested') {
      qb.andWhere('s.status = :workflow', { workflow: 'REVISADO' });
      qb.andWhere('s.reviewOutcome = :out', { out: 'CHANGES_REQUESTED' });
    } else if (status === 'all') {
      // Exclude drafts that are not submitted by default
      qb.andWhere('s.status IN (:...allowed)', {
        allowed: includeUnsubmitted ? ['PENDIENTE', 'ENTREGADO', 'REVISADO'] : ['ENTREGADO', 'REVISADO'],
      });
    }

    const priorityExpr = `
      CASE
        WHEN s.deadline IS NOT NULL AND s.deadline < NOW() THEN 3
        WHEN s.deadline IS NOT NULL
          AND s.deadline >= date_trunc('day', NOW())
          AND s.deadline < date_trunc('day', NOW()) + INTERVAL '1 day' THEN 2
        ELSE 1
      END
    `;

    qb.addSelect(priorityExpr, 'priority_rank');

    if (sort === 'created_at_desc') {
      qb.orderBy('s.submittedAt', 'DESC', 'NULLS LAST');
      qb.addOrderBy('s.createdAt', 'DESC');
    } else if (sort === 'created_at_asc') {
      qb.orderBy('s.submittedAt', 'ASC', 'NULLS LAST');
      qb.addOrderBy('s.createdAt', 'ASC');
    } else {
      qb.orderBy('priority_rank', 'DESC');
      qb.addOrderBy('s.deadline', 'ASC', 'NULLS LAST');
      qb.addOrderBy('s.submittedAt', 'ASC', 'NULLS LAST');
      qb.addOrderBy('s.createdAt', 'ASC');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const { entities, raw } = await qb.getRawAndEntities();

    const totalQb = qb.clone();
    totalQb.skip(undefined as any).take(undefined as any);
    // Count query should not reuse ORDER BY with select aliases (e.g. priority_rank)
    totalQb.orderBy();
    totalQb.select('COUNT(*)', 'cnt');
    const totalRaw = await totalQb.getRawOne<{ cnt: string }>();
    const totalCount = parseInt(totalRaw?.cnt || '0', 10);

    const items = entities.map((s, idx) => {
      const row = raw[idx] as any;
      const priorityRank = Number(row?.priority_rank || 1);
      const priority: UnifiedPriority = priorityRank >= 3 ? 'high' : priorityRank === 2 ? 'medium' : 'low';

      const normalizedStatus =
        s.status === 'PENDIENTE' || s.status === 'ENTREGADO'
          ? 'pending'
          : s.reviewOutcome === 'CHANGES_REQUESTED'
          ? 'changes_requested'
          : 'approved';

      const title = s.evidence?.title || 'Evidencia';
      const milestoneRef = (s.milestone as any) || (s.evidence as any)?.milestone || null;
      const milestoneTitle =
        milestoneRef?.title || (s.evidence as any)?.parent?.title || null;

      return {
        id: s.id,
        course_id: s.projectId,
        course_name: (s.project as any)?.title || '',
        student_id: s.studentId,
        student_name: (s.student as any)?.name || '',
        student_email: (s.student as any)?.email || '',
        title,
        milestone_id: s.milestoneId || milestoneRef?.id || null,
        milestone_title: milestoneTitle,
        status: normalizedStatus,
        priority,
        created_at: iso(s.createdAt),
        submitted_at: iso(s.submittedAt),
        due_at: iso(s.deadline),
        is_late: !!s.isLate,
        evidence_id: s.evidenceId,
        deep_link: `/entregas?open=${s.id}`,
      };
    });

    let next_pending_submission_id: string | null = null;
    if (status === 'pending') {
      const nextQb = this.assignmentsRepo
        .createQueryBuilder('s')
        .innerJoin('s.project', 'course')
        .innerJoin('course.owner', 'teacher')
        .where('teacher.id = :teacherId', { teacherId })
        .andWhere('s.status = :workflow', { workflow: 'ENTREGADO' });

      if (query.course_id) nextQb.andWhere('course.id = :courseId', { courseId: query.course_id });
      if (query.student_id) nextQb.andWhere('s.studentId = :studentId', { studentId: query.student_id });
      if (query.q) {
        const rawTerm = query.q.trim().toLowerCase();
        const normalizedTerm = normalizeSearchTerm(query.q);
        const q = `%${rawTerm}%`;
        const q_norm = `%${normalizedTerm}%`;
        nextQb
          .innerJoin('s.student', 'student')
          .leftJoin('s.evidence', 'evidence')
          .leftJoin('evidence.parent', 'evidenceParent')
          .leftJoin('evidence.milestone', 'evidenceMilestone')
          .leftJoin('s.milestone', 'milestone')
          .andWhere(
            `(
              LOWER(student.name) LIKE :q OR
              LOWER(student.email) LIKE :q OR
              LOWER(course.title) LIKE :q OR
              LOWER(COALESCE(evidence.title, '')) LIKE :q OR
              LOWER(COALESCE(evidenceParent.title, '')) LIKE :q OR
              LOWER(COALESCE(milestone.title, '')) LIKE :q OR
              LOWER(COALESCE(evidenceMilestone.title, '')) LIKE :q OR
              ${normalizedSql('student.name')} LIKE :q_norm OR
              ${normalizedSql('student.email')} LIKE :q_norm OR
              ${normalizedSql('course.title')} LIKE :q_norm OR
              ${normalizedSql('evidence.title')} LIKE :q_norm OR
              ${normalizedSql('evidenceParent.title')} LIKE :q_norm OR
              ${normalizedSql('milestone.title')} LIKE :q_norm OR
              ${normalizedSql('evidenceMilestone.title')} LIKE :q_norm
            )`,
            { q, q_norm },
          );
      }
      // We need a stable "next" according to the current filters and priority.
      // IMPORTANT: select() resets previous addSelect(), so define selects up-front.
      nextQb.select('s.id', 'id');
      nextQb.addSelect(priorityExpr, 'priority_rank');
      if (sort === 'created_at_desc') {
        nextQb.orderBy('s.submittedAt', 'DESC', 'NULLS LAST').addOrderBy('s.createdAt', 'DESC');
      } else if (sort === 'created_at_asc') {
        nextQb.orderBy('s.submittedAt', 'ASC', 'NULLS LAST').addOrderBy('s.createdAt', 'ASC');
      } else {
        nextQb
          .orderBy('priority_rank', 'DESC')
          .addOrderBy('s.deadline', 'ASC', 'NULLS LAST')
          .addOrderBy('s.submittedAt', 'ASC', 'NULLS LAST')
          .addOrderBy('s.createdAt', 'ASC');
      }
      const first = await nextQb.limit(1).getRawOne<{ id: string }>();
      next_pending_submission_id = first?.id ?? null;
    }

    return {
      items,
      total: totalCount,
      page,
      page_size: pageSize,
      next_pending_submission_id,
    };
  }

  async getOne(teacherId: number, submissionId: string) {
    const submission = await this.assignmentsRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.project', 'course')
      .innerJoin('course.owner', 'teacher')
      .leftJoinAndSelect('s.student', 'student')
      .leftJoinAndSelect('s.evidence', 'evidence')
      .leftJoinAndSelect('s.milestone', 'milestone')
      .where('s.id = :id', { id: submissionId })
      .andWhere('teacher.id = :teacherId', { teacherId })
      .getOne();

    if (!submission) throw new NotFoundException('Entrega no encontrada');

    const normalizedStatus =
      submission.status === 'ENTREGADO'
        ? 'pending'
        : submission.reviewOutcome === 'CHANGES_REQUESTED'
        ? 'changes_requested'
        : 'approved';

    // Extra: student's response message/links (often created as separate evidences right after file upload).
    let student_comment: string | null = null;
    let student_links: string[] = [];
    if (submission.milestoneId) {
      const base = submission.submittedAt || submission.createdAt || new Date();
      const from = new Date(base.getTime() - 2 * 60 * 1000); // small buffer for near-simultaneous posts

      const evidences = await this.dataSource.getRepository(Evidence)
        .createQueryBuilder('e')
        .innerJoin('e.author', 'author')
        .innerJoin('e.milestone', 'm')
        .where('author.id = :studentId', { studentId: submission.studentId })
        .andWhere('m.id = :milestoneId', { milestoneId: submission.milestoneId })
        .andWhere('e.createdAt >= :from', { from })
        .orderBy('e.createdAt', 'ASC')
        .getMany();

      const textItems = evidences
        .filter((e) => e.type === EvidenceType.TEXT)
        .map((e) => (e.description || '').trim())
        .filter(Boolean);
      student_comment = textItems.length ? textItems[textItems.length - 1] : null;

      student_links = evidences
        .filter((e) => e.type === EvidenceType.LINK)
        .map((e) => (e.url || '').trim())
        .filter(Boolean);
    }

    return {
      id: submission.id,
      course_id: submission.projectId,
      course_name: (submission.project as any)?.title || '',
      student_id: submission.studentId,
      student_name: (submission.student as any)?.name || '',
      student_email: (submission.student as any)?.email || '',
      evidence_id: submission.evidenceId,
      evidence_title: submission.evidence?.title || null,
      status: normalizedStatus,
      feedback: submission.feedback || '',
      student_comment,
      student_links,
      due_at: iso(submission.deadline),
      submitted_at: iso(submission.submittedAt),
      created_at: iso(submission.createdAt),
      is_late: !!submission.isLate,
    };
  }

  async review(teacherId: number, submissionId: string, dto: ReviewSubmissionDto) {
    const teacher = await this.usersRepo.findOne({ where: { id: teacherId } });
    if (!teacher) throw new ForbiddenException('Docente no encontrado');

    const outcome = dto.status === 'approved' ? 'APPROVED' : 'CHANGES_REQUESTED';
    const feedbackText = (dto.feedback || '').trim();
    const feedbackOrNull = feedbackText.length > 0 ? feedbackText : null;

    const now = new Date();

    await this.dataSource.transaction(async (manager) => {
      const submission = await manager
        .getRepository(Assignment)
        .createQueryBuilder('s')
        .innerJoin('s.project', 'course')
        .innerJoin('course.owner', 'teacher')
        .where('s.id = :id', { id: submissionId })
        .andWhere('teacher.id = :teacherId', { teacherId })
        .getOne();

      if (!submission) throw new NotFoundException('Entrega no encontrada');
      const wasPending = submission.status === 'ENTREGADO';
      const alreadyReviewed = submission.status === 'REVISADO';
      if (!wasPending && !alreadyReviewed) {
        throw new BadRequestException('Esta entrega no está disponible para revisión');
      }

      const isOverdue =
        !!submission.deadline && submission.deadline.getTime() < Date.now();

      await manager.getRepository(Assignment).update(
        { id: submissionId },
        {
          status: 'REVISADO' as any,
          feedback: feedbackOrNull,
          reviewOutcome: outcome,
          reviewedById: teacherId,
          updatedAt: now as any,
        } as any,
      );

      await manager.getRepository(SubmissionReview).insert({
        submissionId,
        teacherId,
        status: dto.status,
        feedback: feedbackOrNull,
        rubricScores: dto.rubric_scores ?? null,
      } as any);

      // Reflejar feedback/estado tambiÃ©n en la evidencia para que el estudiante lo vea en "Ver evidencia".
      if (submission.evidenceId) {
        await manager.getRepository(Evidence).update(
          { id: submission.evidenceId } as any,
          {
            feedback: feedbackOrNull,
            status:
              outcome === 'APPROVED'
                ? (EvidenceStatus.APPROVED as any)
                : (EvidenceStatus.REJECTED as any),
            updatedAt: now as any,
          } as any,
        );
      }

      await manager.getRepository(ActivityFeedEvent).insert({
        teacherId,
        courseId: submission.projectId,
        type: 'submission_reviewed',
        actorType: 'teacher',
        actorId: teacherId,
        actorName: teacher.name || teacher.email,
        entityId: submissionId,
        title: dto.status === 'approved' ? 'Entrega aprobada' : 'Cambios solicitados',
        metadata: {
          submissionId,
          outcome: dto.status,
          feedback: feedbackOrNull,
        },
      } as any);

      // Fast path counters: decrement pending + overdue and touch last activity
      const hasCourseStats = await manager.getRepository(CourseStats).exist({ where: { courseId: submission.projectId } });
      if (!hasCourseStats) {
        await this.statsService.recomputeCourseStats(submission.projectId, teacherId);
      }

      if (wasPending) {
        if (isOverdue) {
          await manager
            .createQueryBuilder()
            .update(CourseStats)
            .set({
              pendingSubmissionsCount: () => `GREATEST("pendingSubmissionsCount" - 1, 0)`,
              overdueSubmissionsCount: () => `GREATEST("overdueSubmissionsCount" - 1, 0)`,
              lastActivityAt: () => 'NOW()',
            })
            .where('"courseId" = :courseId', { courseId: submission.projectId })
            .execute();
        } else {
          await manager
            .createQueryBuilder()
            .update(CourseStats)
            .set({
              pendingSubmissionsCount: () => `GREATEST("pendingSubmissionsCount" - 1, 0)`,
              lastActivityAt: () => 'NOW()',
            })
            .where('"courseId" = :courseId', { courseId: submission.projectId })
            .execute();
        }
      } else {
        // Revisión repetida (ya estaba revisado): no tocar contadores, solo "última actividad".
        await manager
          .createQueryBuilder()
          .update(CourseStats)
          .set({
            lastActivityAt: () => 'NOW()',
          })
          .where('"courseId" = :courseId', { courseId: submission.projectId })
          .execute();
      }

      const hasTeacherStats = await manager.getRepository(TeacherStats).exist({ where: { teacherId } });
      if (!hasTeacherStats) {
        await this.statsService.recomputeTeacherStats(teacherId);
      }

      if (wasPending) {
        if (isOverdue) {
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
        } else {
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
      } else {
        // Revisión repetida (ya estaba revisado): no tocar contadores, solo timestamp.
        await manager
          .createQueryBuilder()
          .update(TeacherStats)
          .set({
            updatedAt: () => 'NOW()',
          })
          .where('"teacherId" = :teacherId', { teacherId })
          .execute();
      }
    });

    return this.getOne(teacherId, submissionId);
  }

  async next(teacherId: number, currentId: string, query: TeacherSubmissionsQueryDto) {
    // Only meaningful for pending lane.
    const courseId = query.course_id ?? null;
    const studentId = query.student_id ?? null;
    const q = (query.q || '').trim().toLowerCase();

    const params: any[] = [teacherId, currentId];
    let where = `p.owner_id = $1 AND s.status = 'ENTREGADO'`;

    if (courseId) {
      params.push(courseId);
      where += ` AND p.id = $${params.length}`;
    }
    if (studentId) {
      params.push(studentId);
      where += ` AND s.\"studentId\" = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      params.push(`%${normalizeSearchTerm(q)}%`);
      const idxNorm = params.length;
      where += ` AND (
        LOWER(student.name) LIKE $${idx} OR
        LOWER(student.email) LIKE $${idx} OR
        LOWER(p.title) LIKE $${idx} OR
        LOWER(COALESCE(e.title, '')) LIKE $${idx} OR
        LOWER(COALESCE(ep.title, '')) LIKE $${idx} OR
        LOWER(COALESCE(m.title, '')) LIKE $${idx} OR
        REGEXP_REPLACE(TRANSLATE(LOWER(COALESCE(student.name, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'), '\\s+', ' ', 'g') LIKE $${idxNorm} OR
        REGEXP_REPLACE(TRANSLATE(LOWER(COALESCE(student.email, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'), '\\s+', ' ', 'g') LIKE $${idxNorm} OR
        REGEXP_REPLACE(TRANSLATE(LOWER(COALESCE(p.title, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'), '\\s+', ' ', 'g') LIKE $${idxNorm} OR
        REGEXP_REPLACE(TRANSLATE(LOWER(COALESCE(e.title, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'), '\\s+', ' ', 'g') LIKE $${idxNorm} OR
        REGEXP_REPLACE(TRANSLATE(LOWER(COALESCE(ep.title, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'), '\\s+', ' ', 'g') LIKE $${idxNorm} OR
        REGEXP_REPLACE(TRANSLATE(LOWER(COALESCE(m.title, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}'), '\\s+', ' ', 'g') LIKE $${idxNorm}
      )`;
    }

    const sql = `
      WITH filtered AS (
        SELECT
          s.id,
          CASE
            WHEN s.deadline IS NOT NULL AND s.deadline < NOW() THEN 3
            WHEN s.deadline IS NOT NULL
              AND s.deadline >= date_trunc('day', NOW())
              AND s.deadline < date_trunc('day', NOW()) + INTERVAL '1 day' THEN 2
            ELSE 1
          END AS pr,
          COALESCE(s.deadline, 'infinity'::timestamp) AS dl,
          COALESCE(s."submittedAt", s."createdAt") AS sa
        FROM assignments s
        JOIN projects p ON p.id = s."projectId"
        JOIN users student ON student.id = s."studentId"
        LEFT JOIN evidences e ON e.id = s."evidenceId"
        LEFT JOIN milestones m ON m.id = COALESCE(s."milestoneId", e."milestoneId")
        LEFT JOIN evidences ep ON ep.id = e."parentId"
        WHERE ${where}
      ),
      ordered AS (
        SELECT id, row_number() OVER (ORDER BY pr DESC, dl ASC, sa ASC, id ASC) AS rn
        FROM filtered
      )
      SELECT id
      FROM ordered
      WHERE rn = (COALESCE((SELECT rn FROM ordered WHERE id = $2), 0) + 1)
      LIMIT 1
    `;

    const rows = await this.assignmentsRepo.query(sql, params);
    const nextId = rows?.[0]?.id ?? null;
    return { next_id: nextId };
  }
}


