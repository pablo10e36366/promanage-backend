import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { Role } from '../../../roles/infrastructure/entities/role.entity';
import { SystemSettings } from '../../../config/infrastructure/entities/system-settings.entity';
import { Project, ProjectStatus } from '../../../projects/infrastructure/entities/project.entity';
import { Review, ReviewStatus } from '../../../reviews/infrastructure/entities/review.entity';
import { CreateUserDto, ChangeRoleDto, BlockUserDto } from '../dto/user-admin.dto';
import { UpdateSettingsDto } from '../dto/admin-project.dto';
import {
  AccessStatus,
  ProjectAccess,
} from '../../../project-access/infrastructure/entities/project-access.entity';
import * as bcrypt from 'bcrypt';
import { ActivityService } from '../../../activity/application/services/activity.service';
import { ActivityAction } from '../../../activity/infrastructure/entities/activity-log.entity';

interface SystemAlert {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  count: number;
  priority: number;
}

interface ProjectCounters {
  draft: number;
  inProgress: number;
  inReview: number;
  completed: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(SystemSettings)
    private readonly settingsRepo: Repository<SystemSettings>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(ProjectAccess)
    private readonly projectAccessRepo: Repository<ProjectAccess>,
    private readonly activityService: ActivityService,
  ) {}

  async createUser(dto: CreateUserDto, adminUser: User): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) {
      throw new BadRequestException('Invalid role ID');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role,
      isActive: true,
    });

    const savedUser = await this.userRepo.save(user);
    await this.activityService.logActivity(adminUser, ActivityAction.USER_ROLE_CHANGE, {
      targetUserId: savedUser.id,
      targetUserEmail: savedUser.email,
      action: 'USER_CREATED',
      roleName: role.name,
    });

    return savedUser;
  }

  async changeRole(userId: number, dto: ChangeRoleDto, adminUser: User): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newRole = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!newRole) {
      throw new BadRequestException('Invalid role ID');
    }

    const oldRole = user.role;
    user.role = newRole;
    const updatedUser = await this.userRepo.save(user);

    await this.activityService.logActivity(adminUser, ActivityAction.USER_ROLE_CHANGE, {
      targetUserId: user.id,
      targetUserEmail: user.email,
      previousRole: oldRole?.name,
      newRole: newRole.name,
    });

    return updatedUser;
  }

  async blockUser(userId: number, dto: BlockUserDto, adminUser: User): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = dto.isActive;
    if (dto.isActive) {
      user.blockedAt = null as any;
      user.blockedBy = null as any;
    } else {
      user.blockedAt = new Date();
      user.blockedBy = adminUser.id;
    }

    const updatedUser = await this.userRepo.save(user);
    await this.activityService.logActivity(adminUser, ActivityAction.USER_ROLE_CHANGE, {
      targetUserId: user.id,
      targetUserEmail: user.email,
      action: dto.isActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
    });

    return updatedUser;
  }

  async findAllUsers(filters?: {
    status?: 'active' | 'blocked';
    roleId?: number;
    search?: string;
  }): Promise<User[]> {
    const query = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .orderBy('user.id', 'DESC');

    if (filters?.status) {
      query.andWhere('user.isActive = :isActive', { isActive: filters.status === 'active' });
    }

    if (filters?.roleId) {
      query.andWhere('user.role.id = :roleId', { roleId: filters.roleId });
    }

    if (filters?.search) {
      query.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }

    return query.getMany();
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepo.createQueryBuilder('role').orderBy('role.id', 'ASC').getMany();
  }

  async getSettings(): Promise<SystemSettings> {
    let settings = await this.settingsRepo.findOne({ where: { id: 1 } });

    if (!settings) {
      settings = this.settingsRepo.create({
        id: 1,
        storageLimit: 5000,
        allowedFileTypes: 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,png',
        maxReviewDays: 14,
        auditLogsEnabled: true,
      });
      settings = await this.settingsRepo.save(settings);
    }

    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto, adminUser: User): Promise<SystemSettings> {
    let settings = await this.getSettings();

    if (dto.storageLimit !== undefined) settings.storageLimit = dto.storageLimit;
    if (dto.allowedFileTypes !== undefined) settings.allowedFileTypes = dto.allowedFileTypes;
    if (dto.maxReviewDays !== undefined) settings.maxReviewDays = dto.maxReviewDays;
    if (dto.auditLogsEnabled !== undefined) settings.auditLogsEnabled = dto.auditLogsEnabled;

    settings = await this.settingsRepo.save(settings);

    await this.activityService.logActivity(
      adminUser,
      ActivityAction.USER_ROLE_CHANGE,
      { action: 'SETTINGS_UPDATED', changes: dto },
    );

    return settings;
  }

  async getDashboardStats(): Promise<any> {
    const activeUsers = await this.userRepo.count({ where: { isActive: true } });
    const projectCounters = await this.getProjectCounters();
    const activeProjects =
      projectCounters.draft + projectCounters.inProgress + projectCounters.inReview;

    const pendingReviews = await this.reviewRepo.count({ where: { status: ReviewStatus.PENDING } });
    const inReview = projectCounters.inReview + pendingReviews;

    const settings = await this.getSettings();
    const storageUsed = await this.calculateStorageUsedPercent(settings.storageLimit);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const inactiveProjects = await this.projectRepo.count({
      where: {
        updatedAt: LessThanOrEqual(thirtyDaysAgo),
        status: ProjectStatus.IN_PROGRESS,
      },
    });

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const stuckReviews = await this.reviewRepo.count({
      where: {
        status: ReviewStatus.PENDING,
        createdAt: LessThanOrEqual(fiveDaysAgo),
      },
    });

    const alerts: SystemAlert[] = [];
    if (inactiveProjects > 0) {
      alerts.push({
        id: 'inactive-projects',
        type: 'danger',
        title: 'Proyectos Inactivos (>30 días)',
        description: `${inactiveProjects} proyectos no han tenido actividad reciente`,
        count: inactiveProjects,
        priority: 2,
      });
    }

    if (stuckReviews > 0) {
      alerts.push({
        id: 'stuck-reviews',
        type: 'warning',
        title: 'Revisiones Estancadas',
        description: `${stuckReviews} revisiones llevan más de 5 días sin resolver`,
        count: stuckReviews,
        priority: 3,
      });
    }

    if (storageUsed > 80) {
      alerts.push({
        id: 'storage-high',
        type: 'warning',
        title: 'Alto Uso de Almacenamiento',
        description: `El ${storageUsed}% del almacenamiento está en uso`,
        count: storageUsed,
        priority: 2,
      });
    }

    if (projectCounters.draft > 10) {
      alerts.push({
        id: 'many-drafts',
        type: 'info',
        title: 'Muchos Proyectos en Borrador',
        description: `${projectCounters.draft} proyectos están en estado borrador`,
        count: projectCounters.draft,
        priority: 4,
      });
    }

    if (activeUsers < 5) {
      alerts.push({
        id: 'low-activity',
        type: 'info',
        title: 'Baja Actividad del Sistema',
        description: `Solo ${activeUsers} usuarios activos`,
        count: activeUsers,
        priority: 5,
      });
    }

    return {
      kpis: { activeUsers, activeProjects, inReview, storageUsed },
      projectStats: {
        draft: projectCounters.draft,
        inProgress: projectCounters.inProgress,
        inReview: projectCounters.inReview,
        completed: projectCounters.completed,
      },
      alerts,
    };
  }

  private async getProjectCounters(): Promise<ProjectCounters> {
    const rows = await this.projectRepo
      .createQueryBuilder('project')
      .select('project.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('project.isArchived = false')
      .groupBy('project.status')
      .getRawMany<{ status: ProjectStatus; count: string }>();

    const counters: ProjectCounters = { draft: 0, inProgress: 0, inReview: 0, completed: 0 };
    for (const row of rows) {
      const total = Number(row.count || 0);
      if (row.status === ProjectStatus.DRAFT) counters.draft = total;
      if (row.status === ProjectStatus.IN_PROGRESS) counters.inProgress = total;
      if (row.status === ProjectStatus.IN_REVIEW) counters.inReview = total;
      if (row.status === ProjectStatus.COMPLETED) counters.completed = total;
    }

    return counters;
  }

  private async calculateStorageUsedPercent(storageLimitMb: number): Promise<number> {
    if (!storageLimitMb || storageLimitMb <= 0) return 0;

    const uploadsPath = join(process.cwd(), 'uploads');
    const bytesInUse = await this.getDirectorySizeSafe(uploadsPath);
    const usedMb = bytesInUse / (1024 * 1024);
    const ratio = (usedMb / storageLimitMb) * 100;

    return Math.max(0, Math.min(100, Math.round(ratio)));
  }

  private async getDirectorySizeSafe(path: string): Promise<number> {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      let totalBytes = 0;
      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        if (entry.isDirectory()) totalBytes += await this.getDirectorySizeSafe(fullPath);
        if (entry.isFile()) totalBytes += (await fs.stat(fullPath)).size;
      }
      return totalBytes;
    } catch {
      return 0;
    }
  }

  async findAllCourses(filters?: {
    status?: ProjectStatus;
    ownerId?: number;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Project[]; total: number; page: number; page_size: number }> {
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters?.pageSize || 10));

    const query = this.projectRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .orderBy('project.updatedAt', 'DESC');

    if (filters?.status) query.andWhere('project.status = :status', { status: filters.status });
    if (filters?.ownerId) query.andWhere('owner.id = :ownerId', { ownerId: filters.ownerId });

    if (filters?.search) {
      query.andWhere(
        '(project.title ILIKE :search OR project.code ILIKE :search OR owner.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const total = await query.getCount();
    const items = await query.skip((page - 1) * pageSize).take(pageSize).getMany();
    return { items, total, page, page_size: pageSize };
  }

  async deleteCourse(courseId: string, adminUser: User): Promise<{ deleted: true }> {
    const course = await this.projectRepo.findOne({
      where: { id: courseId },
      relations: ['owner'],
    });

    if (!course) throw new NotFoundException('Curso no encontrado');
    await this.projectRepo.delete({ id: courseId });

    await this.activityService.logActivity(adminUser, ActivityAction.PROJECT_DELETE, {
      courseId: course.id,
      courseTitle: course.title,
      ownerId: course.owner?.id || null,
      ownerEmail: course.owner?.email || null,
      action: 'ADMIN_COURSE_DELETE',
    });

    return { deleted: true };
  }

  async listAccessRequests(filters?: {
    status?: AccessStatus;
    courseId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ProjectAccess[]; total: number; page: number; page_size: number }> {
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters?.pageSize || 10));

    const query = this.projectAccessRepo
      .createQueryBuilder('access')
      .leftJoinAndSelect('access.project', 'project')
      .leftJoinAndSelect('access.user', 'user')
      .leftJoinAndSelect('access.grantedBy', 'grantedBy')
      .orderBy('access.requestedAt', 'DESC');

    if (filters?.status) query.andWhere('access.status = :status', { status: filters.status });
    if (filters?.courseId) query.andWhere('project.id = :courseId', { courseId: filters.courseId });

    if (filters?.search) {
      query.andWhere(
        '(project.title ILIKE :search OR user.email ILIKE :search OR user.name ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const total = await query.getCount();
    const items = await query.skip((page - 1) * pageSize).take(pageSize).getMany();
    return { items, total, page, page_size: pageSize };
  }

  async resolveAccessRequest(
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    adminUser: User,
    notes?: string,
  ): Promise<ProjectAccess> {
    const request = await this.projectAccessRepo.findOne({
      where: { id: requestId },
      relations: ['project', 'user', 'grantedBy'],
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== AccessStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue procesada');
    }

    request.status = decision === 'APPROVE' ? AccessStatus.APPROVED : AccessStatus.REJECTED;
    request.grantedBy = adminUser;
    request.resolvedAt = new Date();
    if (notes?.trim()) request.notes = notes.trim();

    const saved = await this.projectAccessRepo.save(request);
    await this.activityService.logActivity(adminUser, ActivityAction.USER_ASSIGN, {
      action: decision === 'APPROVE' ? 'ADMIN_ACCESS_APPROVED' : 'ADMIN_ACCESS_REJECTED',
      requestId: saved.id,
      projectId: saved.project?.id || null,
      projectTitle: saved.project?.title || null,
      targetUserId: saved.user?.id || null,
      targetUserEmail: saved.user?.email || null,
    });

    return saved;
  }
}


