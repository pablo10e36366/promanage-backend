import { Injectable } from '@nestjs/common';

import { User } from '../../../users/infrastructure/entities/user.entity';
import { CreateUserDto, ChangeRoleDto, BlockUserDto } from '../dto/user-admin.dto';
import { UpdateSettingsDto } from '../dto/admin-project.dto';
import { CreateUserUseCase } from '../use-cases/create-user.use-case';
import { ChangeUserRoleUseCase } from '../use-cases/change-user-role.use-case';
import { SetUserActiveUseCase } from '../use-cases/set-user-active.use-case';
import { ListUsersUseCase } from '../use-cases/list-users.use-case';
import { ListRolesUseCase } from '../use-cases/list-roles.use-case';
import { GetSettingsUseCase } from '../use-cases/get-settings.use-case';
import { UpdateSettingsUseCase } from '../use-cases/update-settings.use-case';
import { GetDashboardStatsUseCase } from '../use-cases/get-dashboard-stats.use-case';
import { ListCoursesUseCase } from '../use-cases/list-courses.use-case';
import { DeleteCourseUseCase } from '../use-cases/delete-course.use-case';
import { ListAccessRequestsUseCase } from '../use-cases/list-access-requests.use-case';
import { ResolveAccessRequestUseCase } from '../use-cases/resolve-access-request.use-case';
import { ProjectStatus } from '../../../projects/infrastructure/entities/project.entity';
import { AccessStatus } from '../../../project-access/infrastructure/entities/project-access.entity';

@Injectable()
export class AdminFacadeService {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly changeUserRoleUseCase: ChangeUserRoleUseCase,
    private readonly setUserActiveUseCase: SetUserActiveUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly getSettingsUseCase: GetSettingsUseCase,
    private readonly updateSettingsUseCase: UpdateSettingsUseCase,
    private readonly getDashboardStatsUseCase: GetDashboardStatsUseCase,
    private readonly listCoursesUseCase: ListCoursesUseCase,
    private readonly deleteCourseUseCase: DeleteCourseUseCase,
    private readonly listAccessRequestsUseCase: ListAccessRequestsUseCase,
    private readonly resolveAccessRequestUseCase: ResolveAccessRequestUseCase,
  ) {}

  createUser(dto: CreateUserDto, actor: User) {
    return this.createUserUseCase.execute(dto, actor);
  }

  changeUserRole(userId: number, dto: ChangeRoleDto, actor: User) {
    return this.changeUserRoleUseCase.execute(userId, dto, actor);
  }

  setUserActive(userId: number, dto: BlockUserDto, actor: User) {
    return this.setUserActiveUseCase.execute(userId, dto, actor);
  }

  listUsers(filters?: { status?: 'active' | 'blocked'; roleId?: number; search?: string }) {
    return this.listUsersUseCase.execute(filters);
  }

  listRoles() {
    return this.listRolesUseCase.execute();
  }

  getSettings() {
    return this.getSettingsUseCase.execute();
  }

  updateSettings(dto: UpdateSettingsDto, actor: User) {
    return this.updateSettingsUseCase.execute(dto, actor);
  }

  getDashboardStats() {
    return this.getDashboardStatsUseCase.execute();
  }

  listCourses(filters?: {
    status?: ProjectStatus;
    ownerId?: number;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.listCoursesUseCase.execute(filters);
  }

  deleteCourse(courseId: string, actor: User) {
    return this.deleteCourseUseCase.execute(courseId, actor);
  }

  listAccessRequests(filters?: {
    status?: AccessStatus;
    courseId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.listAccessRequestsUseCase.execute(filters);
  }

  resolveAccessRequest(
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    actor: User,
    notes?: string,
  ) {
    return this.resolveAccessRequestUseCase.execute(requestId, decision, actor, notes);
  }
}


