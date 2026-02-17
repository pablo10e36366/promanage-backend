import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from '../../../projects/infrastructure/entities/project.entity';
import {
  AccessStatus,
  ProjectAccess,
} from '../../../project-access/infrastructure/entities/project-access.entity';
import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import { AssignmentStatus } from '../../../assignments/domain/assignment-status';

type ListStudentCoursesArgs = {
  studentId: number;
  page: number;
  pageSize: number;
  search?: string;
};

@Injectable()
export class StudentCoursesService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ProjectAccess)
    private readonly accessRepo: Repository<ProjectAccess>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
  ) {}

  async listCourses(args: ListStudentCoursesArgs): Promise<{
    items: Array<{
      id: string;
      name: string;
      code: string | null;
      teacher_name: string | null;
      students_count: number;
      pending_assignments_count: number;
      last_activity_at: string | null;
    }>;
    total: number;
  }> {
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.max(1, Math.min(100, args.pageSize || 10));
    const q = (args.search || '').trim();

    const baseQb = this.accessRepo
      .createQueryBuilder('access')
      .innerJoinAndSelect('access.project', 'project')
      .leftJoinAndSelect('project.owner', 'teacher')
      .where('access.user_id = :studentId', { studentId: args.studentId })
      .andWhere('access.status = :status', { status: AccessStatus.APPROVED });

    if (q) {
      baseQb.andWhere(
        '(project.title ILIKE :q OR project.code ILIKE :q OR teacher.name ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    const total = await baseQb.getCount();

    const accesses = await baseQb
      .orderBy('project.updatedAt', 'DESC')
      .addOrderBy('project.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const courseIds = accesses.map((a) => a.project?.id).filter(Boolean) as string[];
    if (courseIds.length === 0) {
      return { items: [], total };
    }

    const studentsCounts = await this.accessRepo
      .createQueryBuilder('a')
      .select('a.project_id', 'course_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.project_id IN (:...ids)', { ids: courseIds })
      .andWhere('a.status = :status', { status: AccessStatus.APPROVED })
      .groupBy('a.project_id')
      .getRawMany<{ course_id: string; cnt: string }>();

    const studentsCountByCourse = new Map(
      studentsCounts.map((r) => [r.course_id, Number(r.cnt) || 0]),
    );

    const pendingCounts = await this.assignmentsRepo
      .createQueryBuilder('s')
      .select('s.projectId', 'course_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.studentId = :studentId', { studentId: args.studentId })
      .andWhere('s.projectId IN (:...ids)', { ids: courseIds })
      .andWhere('s.status = :status', { status: AssignmentStatus.PENDIENTE })
      .groupBy('s.projectId')
      .getRawMany<{ course_id: string; cnt: string }>();

    const pendingByCourse = new Map(pendingCounts.map((r) => [r.course_id, Number(r.cnt) || 0]));

    const lastActivityRows = await this.assignmentsRepo
      .createQueryBuilder('s')
      .select('s.projectId', 'course_id')
      .addSelect('MAX(s.updatedAt)', 'last_activity_at')
      .where('s.studentId = :studentId', { studentId: args.studentId })
      .andWhere('s.projectId IN (:...ids)', { ids: courseIds })
      .groupBy('s.projectId')
      .getRawMany<{ course_id: string; last_activity_at: string | null }>();

    const lastActivityByCourse = new Map(
      lastActivityRows.map((r) => [r.course_id, r.last_activity_at ? new Date(r.last_activity_at).toISOString() : null]),
    );

    const items = accesses.map((access) => {
      const course = access.project;
      const courseId = course.id;

      return {
        id: courseId,
        name: course.title,
        code: course.code ?? null,
        teacher_name: (course.owner as any)?.name ?? null,
        students_count: studentsCountByCourse.get(courseId) ?? 0,
        pending_assignments_count: pendingByCourse.get(courseId) ?? 0,
        last_activity_at: lastActivityByCourse.get(courseId) ?? null,
      };
    });

    return { items, total };
  }

  async listAvailableCourses(args: ListStudentCoursesArgs): Promise<{
    items: Array<{
      id: string;
      name: string;
      code: string | null;
      teacher_name: string | null;
      students_count: number;
      pending_assignments_count: number;
      last_activity_at: string | null;
      join_status: AccessStatus | null;
      join_request_id: string | null;
    }>;
    total: number;
  }> {
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.max(1, Math.min(100, args.pageSize || 10));
    const q = (args.search || '').trim();

    // Cursos = proyectos creados por un docente (owner.role = 'docente') con code definido.
    const baseQb = this.projectsRepo
      .createQueryBuilder('course')
      .innerJoin('course.owner', 'teacher')
      .innerJoin('teacher.role', 'teacherRole')
      .leftJoin(
        ProjectAccess,
        'access',
        'access.project_id = course.id AND access.user_id = :studentId',
        { studentId: args.studentId },
      )
      .where('teacherRole.name = :teacherRole', { teacherRole: 'docente' })
      .andWhere('course.isArchived = false')
      .andWhere('course.code IS NOT NULL')
      .andWhere('teacher.id <> :studentId', { studentId: args.studentId });

    // Si ya está inscrito (APPROVED), no mostrarlo en "disponibles".
    baseQb.andWhere('(access.status IS NULL OR access.status <> :approved)', {
      approved: AccessStatus.APPROVED,
    });

    if (q) {
      baseQb.andWhere('(course.title ILIKE :q OR course.code ILIKE :q OR teacher.name ILIKE :q)', {
        q: `%${q}%`,
      });
    }

    const total = await baseQb.getCount();

    const rows = await baseQb
      .select([
        'course.id AS course_id',
        'course.title AS course_title',
        'course.code AS course_code',
        'course.updatedAt AS course_updated_at',
        'teacher.name AS teacher_name',
        'teacher.email AS teacher_email',
        'access.status AS join_status',
        'access.id AS join_request_id',
      ])
      .orderBy('course.updatedAt', 'DESC')
      .addOrderBy('course.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany<{
        course_id: string;
        course_title: string;
        course_code: string | null;
        course_updated_at: Date | string | null;
        teacher_name: string | null;
        teacher_email: string | null;
        join_status: AccessStatus | null;
        join_request_id: string | null;
      }>();

    const courseIds = rows.map((r) => r.course_id).filter(Boolean);
    if (courseIds.length === 0) {
      return { items: [], total };
    }

    const studentsCounts = await this.accessRepo
      .createQueryBuilder('a')
      .select('a.project_id', 'course_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.project_id IN (:...ids)', { ids: courseIds })
      .andWhere('a.status = :status', { status: AccessStatus.APPROVED })
      .groupBy('a.project_id')
      .getRawMany<{ course_id: string; cnt: string }>();

    const studentsCountByCourse = new Map(
      studentsCounts.map((r) => [r.course_id, Number(r.cnt) || 0]),
    );

    const items = rows.map((r) => ({
      id: r.course_id,
      name: r.course_title,
      code: r.course_code ?? null,
      teacher_name: r.teacher_name ?? r.teacher_email ?? null,
      students_count: studentsCountByCourse.get(r.course_id) ?? 0,
      pending_assignments_count: 0,
      last_activity_at: r.course_updated_at ? new Date(r.course_updated_at as any).toISOString() : null,
      join_status: r.join_status ?? null,
      join_request_id: r.join_request_id ?? null,
    }));

    return { items, total };
  }
}
