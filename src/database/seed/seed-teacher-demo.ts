import 'reflect-metadata';
import bcrypt from 'bcrypt';

import dataSource from '../data-source';
import { Role } from '../../roles/infrastructure/entities/role.entity';
import { User } from '../../users/infrastructure/entities/user.entity';
import { Project } from '../../projects/infrastructure/entities/project.entity';
import { ProjectAccess, AccessStatus, ProjectPermission } from '../../project-access/infrastructure/entities/project-access.entity';
import { Milestone, MilestoneStatus } from '../../milestones/infrastructure/entities/milestone.entity';
import { Evidence, EvidenceStatus, EvidenceType } from '../../evidences/infrastructure/entities/evidence.entity';
import { Assignment } from '../../assignments/infrastructure/entities/assignment.entity';
import { Thread } from '../../teacher/infrastructure/entities/thread.entity';
import { ThreadReply } from '../../teacher/infrastructure/entities/thread-reply.entity';
import { ActivityFeedEvent } from '../../teacher/infrastructure/entities/activity-feed-event.entity';
import { CourseStats } from '../../teacher/infrastructure/entities/course-stats.entity';
import { TeacherStats } from '../../teacher/infrastructure/entities/teacher-stats.entity';
import { SubmissionReview } from '../../teacher/infrastructure/entities/submission-review.entity';

type SeedUser = { id: number; email: string; name: string };

async function ensureRole(name: string): Promise<Role> {
  const repo = dataSource.getRepository(Role);
  const existing = await repo.findOne({ where: { name: name as any } });
  if (existing) return existing;
  return repo.save(repo.create({ name: name as any }));
}

async function ensureUser(params: {
  email: string;
  name: string;
  passwordPlain: string;
  roleName: string;
}): Promise<User> {
  const usersRepo = dataSource.getRepository(User);
  const rolesRepo = dataSource.getRepository(Role);

  const existing = await usersRepo.findOne({ where: { email: params.email } });
  const role = await rolesRepo.findOne({ where: { name: params.roleName as any } });
  if (!role) throw new Error(`Missing role: ${params.roleName}`);

  const passwordHash = await bcrypt.hash(params.passwordPlain, 10);

  if (existing) {
    // Keep seed idempotent: always normalize seeded accounts
    existing.name = params.name;
    existing.password = passwordHash;
    existing.role = role;
    existing.isActive = true;
    return usersRepo.save(existing);
  }

  const user = usersRepo.create({
    email: params.email,
    name: params.name,
    password: passwordHash,
    role,
    isActive: true,
  });
  return usersRepo.save(user);
}

async function ensureCourse(params: {
  teacher: User;
  code: string;
  title: string;
  description: string;
}): Promise<Project> {
  const repo = dataSource.getRepository(Project);
  const existing = await repo
    .createQueryBuilder('p')
    .leftJoin('p.owner', 'owner')
    .where('owner.id = :teacherId', { teacherId: params.teacher.id })
    .andWhere('p.code = :code', { code: params.code })
    .getOne();

  if (existing) return existing;

  const course = repo.create({
    title: params.title,
    description: params.description,
    code: params.code,
    owner: params.teacher,
    status: 'draft' as any,
  });
  return repo.save(course);
}

async function ensureEnrollment(params: { course: Project; student: User; teacher: User }) {
  const repo = dataSource.getRepository(ProjectAccess);
  const existing = await repo.findOne({
    where: {
      project: { id: params.course.id } as any,
      user: { id: params.student.id } as any,
    } as any,
  });
  if (existing) return existing;

  return repo.save(
    repo.create({
      project: params.course,
      user: params.student,
      permission: ProjectPermission.VIEW,
      status: AccessStatus.APPROVED,
      grantedBy: params.teacher,
      resolvedAt: new Date(),
      requestedAt: new Date(),
    } as any),
  );
}

async function ensureMilestone(params: {
  course: Project;
  title: string;
  order: number;
  dueDate: Date | null;
}): Promise<Milestone> {
  const repo = dataSource.getRepository(Milestone);
  const existing = await repo
    .createQueryBuilder('m')
    .innerJoin('m.project', 'p')
    .where('p.id = :courseId', { courseId: params.course.id })
    .andWhere('m.title = :title', { title: params.title })
    .getOne();
  if (existing) return existing;

  const milestone = repo.create({
    title: params.title,
    description: `Actividad: ${params.title}`,
    order: params.order,
    dueDate: params.dueDate ?? undefined,
    status: MilestoneStatus.PENDING,
    project: params.course,
  });
  return repo.save(milestone);
}

async function ensureEvidence(params: {
  milestone: Milestone;
  author: User;
  title: string;
  mimeType?: string;
}): Promise<Evidence> {
  const repo = dataSource.getRepository(Evidence);
  const existing = await repo
    .createQueryBuilder('e')
    .innerJoin('e.milestone', 'm')
    .innerJoin('e.author', 'a')
    .where('m.id = :mid', { mid: params.milestone.id })
    .andWhere('a.id = :aid', { aid: params.author.id })
    .andWhere('e.title = :title', { title: params.title })
    .getOne();
  if (existing) return existing;

  const evidence = repo.create({
    title: params.title,
    isFolder: false,
    mimeType: params.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    contentBlob: null,
    url: `uploads/${encodeURIComponent(params.title)}`,
    status: EvidenceStatus.SUBMITTED,
    type: EvidenceType.FILE,
    milestone: params.milestone,
    author: params.author,
  });
  return repo.save(evidence);
}

async function ensureSubmission(params: {
  course: Project;
  milestone: Milestone;
  student: User;
  evidence: Evidence;
  status: 'ENTREGADO' | 'REVISADO';
  deadline: Date | null;
  submittedAt: Date | null;
  reviewOutcome?: 'APPROVED' | 'CHANGES_REQUESTED' | null;
  feedback?: string | null;
  reviewedById?: number | null;
}): Promise<Assignment> {
  const repo = dataSource.getRepository(Assignment);

  const existing = await repo.findOne({
    where: {
      projectId: params.course.id,
      milestoneId: params.milestone.id,
      studentId: params.student.id,
      evidenceId: params.evidence.id,
    } as any,
  });
  if (existing) return existing;

  const isLate = !!(params.deadline && params.submittedAt && params.submittedAt > params.deadline);

  const submission = repo.create({
    projectId: params.course.id,
    milestoneId: params.milestone.id,
    studentId: params.student.id,
    evidenceId: params.evidence.id,
    status: params.status as any,
    deadline: params.deadline,
    submittedAt: params.submittedAt,
    isLate,
    feedback: params.feedback ?? null,
    reviewOutcome: params.reviewOutcome ?? null,
    reviewedById: params.reviewedById ?? null,
  });
  return repo.save(submission);
}

async function ensureThread(params: {
  teacherId: number;
  courseId: string;
  authorId: number;
  title: string;
  message: string;
  status: 'UNANSWERED' | 'ANSWERED';
}): Promise<Thread> {
  const repo = dataSource.getRepository(Thread);
  const existing = await repo.findOne({
    where: {
      teacherId: params.teacherId,
      courseId: params.courseId,
      authorId: params.authorId,
      title: params.title,
    } as any,
  });
  if (existing) return existing;
  const thread = repo.create(params);
  return repo.save(thread);
}

async function ensureThreadReply(params: { threadId: string; authorId: number; message: string }): Promise<ThreadReply> {
  const repo = dataSource.getRepository(ThreadReply);
  const existing = await repo.findOne({
    where: { threadId: params.threadId, authorId: params.authorId, message: params.message } as any,
  });
  if (existing) return existing;
  const reply = repo.create(params);
  return repo.save(reply);
}

async function ensureFeedEvent(
  params: Partial<ActivityFeedEvent> & { teacherId: number; courseId: string; type: any },
): Promise<ActivityFeedEvent> {
  const repo = dataSource.getRepository(ActivityFeedEvent);

  if (params.entityId) {
    const existing = await repo.findOne({
      where: { teacherId: params.teacherId, type: params.type, entityId: params.entityId as any } as any,
    });
    if (existing) return existing;
  }

  const event = repo.create(params);
  return repo.save(event);
}

async function upsertStatsForTeacher(teacher: User, courses: Project[]) {
  const courseStatsRepo = dataSource.getRepository(CourseStats);
  const teacherStatsRepo = dataSource.getRepository(TeacherStats);
  const accessRepo = dataSource.getRepository(ProjectAccess);
  const submissionsRepo = dataSource.getRepository(Assignment);
  const threadsRepo = dataSource.getRepository(Thread);
  const feedRepo = dataSource.getRepository(ActivityFeedEvent);

  let totalPending = 0;
  let totalUnanswered = 0;
  let totalOverdue = 0;

  for (const course of courses) {
    const studentsCount = await accessRepo
      .createQueryBuilder('pa')
      .innerJoin('pa.project', 'p')
      .innerJoin('pa.user', 'u')
      .where('p.id = :courseId', { courseId: course.id })
      .andWhere('pa.status = :approved', { approved: AccessStatus.APPROVED })
      .andWhere('u.id <> :teacherId', { teacherId: teacher.id })
      .getCount();

    const pendingSubmissionsCount = await submissionsRepo
      .createQueryBuilder('s')
      .where('s.projectId = :courseId', { courseId: course.id })
      .andWhere("s.status = 'ENTREGADO'")
      .getCount();

    const overdueSubmissionsCount = await submissionsRepo
      .createQueryBuilder('s')
      .where('s.projectId = :courseId', { courseId: course.id })
      .andWhere("s.status = 'ENTREGADO'")
      .andWhere('s.deadline IS NOT NULL')
      .andWhere('s.deadline < NOW()')
      .getCount();

    const unansweredThreadsCount = await threadsRepo
      .createQueryBuilder('t')
      .where('t.courseId = :courseId', { courseId: course.id })
      .andWhere("t.status = 'UNANSWERED'")
      .getCount();

    const lastEvent = await feedRepo
      .createQueryBuilder('e')
      .select('MAX(e.createdAt)', 'max')
      .where('e.courseId = :courseId', { courseId: course.id })
      .getRawOne<{ max: string | null }>();

    const lastActivityAt = lastEvent?.max ? new Date(lastEvent.max) : new Date();

    await courseStatsRepo.save(
      courseStatsRepo.create({
        courseId: course.id,
        teacherId: teacher.id,
        studentsCount,
        pendingSubmissionsCount,
        unansweredThreadsCount,
        overdueSubmissionsCount,
        lastActivityAt,
      } as any),
    );

    totalPending += pendingSubmissionsCount;
    totalUnanswered += unansweredThreadsCount;
    totalOverdue += overdueSubmissionsCount;
  }

  await teacherStatsRepo.save(
    teacherStatsRepo.create({
      teacherId: teacher.id,
      pendingSubmissionsCount: totalPending,
      unansweredThreadsCount: totalUnanswered,
      overdueCount: totalOverdue,
    } as any),
  );
}

async function main() {
  await dataSource.initialize();

  await ensureRole('admin');
  await ensureRole('docente');
  await ensureRole('colaborador');
  await ensureRole('usuario');

  const teacher = await ensureUser({
    email: 'docente@promanage.com',
    name: 'Docente Promanage',
    passwordPlain: '12345678',
    roleName: 'docente',
  });

  const students: User[] = [];
  for (let i = 1; i <= 6; i++) {
    const u = await ensureUser({
      email: `student${i}@promanage.com`,
      name: `Estudiante ${i}`,
      passwordPlain: '12345678',
      roleName: 'colaborador',
    });
    students.push(u);
  }

  const coursePO = await ensureCourse({
    teacher,
    code: '0000',
    title: 'ProgramaciÃ³n Orientada',
    description: 'Curso demo para navegaciÃ³n por tareas.',
  });

  const courseGD = await ensureCourse({
    teacher,
    code: '0001',
    title: 'GestiÃ³n de Base de Datos',
    description: 'Curso demo para navegaciÃ³n por tareas.',
  });

  const poStudents = students.slice(0, 3);
  const gdStudents = students.slice(3, 6);

  for (const s of poStudents) await ensureEnrollment({ course: coursePO, student: s, teacher });
  for (const s of gdStudents) await ensureEnrollment({ course: courseGD, student: s, teacher });

  const now = Date.now();
  const overdueDate = new Date(now - 2 * 24 * 60 * 60 * 1000);
  const dueToday = new Date(now + 2 * 60 * 60 * 1000);

  const poM1 = await ensureMilestone({ course: coursePO, title: 'Casos de uso', order: 1, dueDate: dueToday });
  const poM2 = await ensureMilestone({ course: coursePO, title: 'Diagrama de clases', order: 2, dueDate: null });
  const gdM1 = await ensureMilestone({ course: courseGD, title: 'Modelo entidad-relaciÃ³n', order: 1, dueDate: overdueDate });
  const gdM2 = await ensureMilestone({ course: courseGD, title: 'NormalizaciÃ³n', order: 2, dueDate: null });

  // 6 submissions (mix of pending/approved/changes_requested, with some overdue)
  const submissions: Assignment[] = [];

  const e1 = await ensureEvidence({ milestone: poM1, author: poStudents[0], title: 'Entrega - Casos de uso (S1).docx' });
  submissions.push(
    await ensureSubmission({
      course: coursePO,
      milestone: poM1,
      student: poStudents[0],
      evidence: e1,
      status: 'ENTREGADO',
      deadline: dueToday,
      submittedAt: new Date(now - 30 * 60 * 1000),
    }),
  );

  const e2 = await ensureEvidence({ milestone: poM1, author: poStudents[1], title: 'Entrega - Casos de uso (S2).docx' });
  submissions.push(
    await ensureSubmission({
      course: coursePO,
      milestone: poM1,
      student: poStudents[1],
      evidence: e2,
      status: 'REVISADO',
      deadline: dueToday,
      submittedAt: new Date(now - 2 * 60 * 60 * 1000),
      reviewOutcome: 'APPROVED',
      feedback: 'Buen trabajo. ðŸ‘',
      reviewedById: teacher.id,
    }),
  );

  const e3 = await ensureEvidence({ milestone: poM2, author: poStudents[2], title: 'Entrega - Diagrama de clases (S3).pdf', mimeType: 'application/pdf' });
  submissions.push(
    await ensureSubmission({
      course: coursePO,
      milestone: poM2,
      student: poStudents[2],
      evidence: e3,
      status: 'REVISADO',
      deadline: null,
      submittedAt: new Date(now - 6 * 60 * 60 * 1000),
      reviewOutcome: 'CHANGES_REQUESTED',
      feedback: 'Faltan relaciones entre entidades. Revisa y re-envÃ­a.',
      reviewedById: teacher.id,
    }),
  );

  const e4 = await ensureEvidence({ milestone: gdM1, author: gdStudents[0], title: 'Entrega - MER (S4).png', mimeType: 'image/png' });
  submissions.push(
    await ensureSubmission({
      course: courseGD,
      milestone: gdM1,
      student: gdStudents[0],
      evidence: e4,
      status: 'ENTREGADO',
      deadline: overdueDate,
      submittedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
    }),
  );

  const e5 = await ensureEvidence({ milestone: gdM2, author: gdStudents[1], title: 'Entrega - NormalizaciÃ³n (S5).docx' });
  submissions.push(
    await ensureSubmission({
      course: courseGD,
      milestone: gdM2,
      student: gdStudents[1],
      evidence: e5,
      status: 'ENTREGADO',
      deadline: null,
      submittedAt: new Date(now - 20 * 60 * 1000),
    }),
  );

  const e6 = await ensureEvidence({ milestone: gdM2, author: gdStudents[2], title: 'Entrega - NormalizaciÃ³n (S6).docx' });
  submissions.push(
    await ensureSubmission({
      course: courseGD,
      milestone: gdM2,
      student: gdStudents[2],
      evidence: e6,
      status: 'REVISADO',
      deadline: null,
      submittedAt: new Date(now - 90 * 60 * 1000),
      reviewOutcome: 'APPROVED',
      feedback: 'Correcto.',
      reviewedById: teacher.id,
    }),
  );

  // Reviews + feed events for submissions
  for (const s of submissions) {
    const author = await dataSource.getRepository(User).findOne({ where: { id: s.studentId } });
    const courseId = s.projectId;

    await ensureFeedEvent({
      teacherId: teacher.id,
      courseId,
      type: 'submission_created',
      actorType: 'student',
      actorId: s.studentId,
      actorName: author?.name || author?.email || null,
      entityId: s.id,
      title: 'Nueva entrega',
      metadata: { submissionId: s.id, evidenceId: s.evidenceId },
    });

    if (s.status === 'REVISADO') {
      await dataSource.getRepository(SubmissionReview).save(
        dataSource.getRepository(SubmissionReview).create({
          submissionId: s.id,
          teacherId: teacher.id,
          status: s.reviewOutcome === 'CHANGES_REQUESTED' ? 'changes_requested' : 'approved',
          feedback: s.feedback || null,
          rubricScores: null,
        } as any),
      );

      await ensureFeedEvent({
        teacherId: teacher.id,
        courseId,
        type: 'submission_reviewed',
        actorType: 'teacher',
        actorId: teacher.id,
        actorName: teacher.name || teacher.email,
        entityId: s.id,
        title: s.reviewOutcome === 'CHANGES_REQUESTED' ? 'Cambios solicitados' : 'Entrega aprobada',
        metadata: { submissionId: s.id, outcome: s.reviewOutcome === 'CHANGES_REQUESTED' ? 'changes_requested' : 'approved' },
      });
    }
  }

  // Threads (4) + replies + feed events
  const t1 = await ensureThread({
    teacherId: teacher.id,
    courseId: coursePO.id,
    authorId: poStudents[0].id,
    title: 'Duda sobre Casos de Uso',
    message: 'Â¿Debo incluir actores secundarios en la descripciÃ³n?',
    status: 'UNANSWERED',
  });

  const t2 = await ensureThread({
    teacherId: teacher.id,
    courseId: coursePO.id,
    authorId: poStudents[2].id,
    title: 'Formato de entrega',
    message: 'Â¿La entrega puede ser PDF?',
    status: 'ANSWERED',
  });

  const t3 = await ensureThread({
    teacherId: teacher.id,
    courseId: courseGD.id,
    authorId: gdStudents[0].id,
    title: 'Modelo ER',
    message: 'Â¿CÃ³mo represento una relaciÃ³n many-to-many?',
    status: 'UNANSWERED',
  });

  const t4 = await ensureThread({
    teacherId: teacher.id,
    courseId: courseGD.id,
    authorId: gdStudents[2].id,
    title: 'NormalizaciÃ³n',
    message: 'Â¿Hasta quÃ© forma normal debemos llegar?',
    status: 'ANSWERED',
  });

  const reply1 = await ensureThreadReply({ threadId: t2.id, authorId: teacher.id, message: 'SÃ­, PDF estÃ¡ perfecto.' });
  const reply2 = await ensureThreadReply({ threadId: t4.id, authorId: teacher.id, message: 'Hasta 3FN es suficiente para este curso.' });

  for (const t of [t1, t2, t3, t4]) {
    const author = await dataSource.getRepository(User).findOne({ where: { id: t.authorId } });
    await ensureFeedEvent({
      teacherId: teacher.id,
      courseId: t.courseId,
      type: 'thread_created',
      actorType: 'student',
      actorId: t.authorId,
      actorName: author?.name || author?.email || null,
      entityId: t.id,
      title: 'Nueva duda',
      metadata: { threadId: t.id },
    });
  }

  for (const r of [reply1, reply2]) {
    const thread = await dataSource.getRepository(Thread).findOne({ where: { id: r.threadId } });
    if (!thread) continue;
    await ensureFeedEvent({
      teacherId: teacher.id,
      courseId: thread.courseId,
      type: 'reply_created',
      actorType: 'teacher',
      actorId: teacher.id,
      actorName: teacher.name || teacher.email,
      entityId: thread.id,
      title: 'Respuesta del docente',
      metadata: { threadId: thread.id, replyId: r.id },
    });
  }

  await upsertStatsForTeacher(teacher, [coursePO, courseGD]);

  console.log('Seed teacher demo OK');
  console.log('Teacher login: docente@promanage.com / 12345678');
}

main()
  .catch((err) => {
    console.error('Seed teacher demo failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await dataSource.destroy();
    } catch {}
  });

