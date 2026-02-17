import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './presentation/controllers/admin.controller';
import { AdminService } from './application/services/admin.service';
import { User } from '../users/infrastructure/entities/user.entity';
import { Role } from '../roles/infrastructure/entities/role.entity';
import { SystemSettings } from '../config/infrastructure/entities/system-settings.entity';
import { ActivityModule } from '../activity/activity.module';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { Review } from '../reviews/infrastructure/entities/review.entity';
import { AdminFacadeService } from './application/services/admin-facade.service';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { ChangeUserRoleUseCase } from './application/use-cases/change-user-role.use-case';
import { SetUserActiveUseCase } from './application/use-cases/set-user-active.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case';
import { GetSettingsUseCase } from './application/use-cases/get-settings.use-case';
import { UpdateSettingsUseCase } from './application/use-cases/update-settings.use-case';
import { GetDashboardStatsUseCase } from './application/use-cases/get-dashboard-stats.use-case';
import { ListCoursesUseCase } from './application/use-cases/list-courses.use-case';
import { DeleteCourseUseCase } from './application/use-cases/delete-course.use-case';
import { ListAccessRequestsUseCase } from './application/use-cases/list-access-requests.use-case';
import { ResolveAccessRequestUseCase } from './application/use-cases/resolve-access-request.use-case';
import { ProjectAccess } from '../project-access/infrastructure/entities/project-access.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Role, SystemSettings, Project, Review, ProjectAccess]),
        ActivityModule,
    ],
    controllers: [AdminController],
    providers: [
        AdminService,
        AdminFacadeService,
        CreateUserUseCase,
        ChangeUserRoleUseCase,
        SetUserActiveUseCase,
        ListUsersUseCase,
        ListRolesUseCase,
        GetSettingsUseCase,
        UpdateSettingsUseCase,
        GetDashboardStatsUseCase,
        ListCoursesUseCase,
        DeleteCourseUseCase,
        ListAccessRequestsUseCase,
        ResolveAccessRequestUseCase,
    ],
    exports: [AdminService, AdminFacadeService],
})
export class AdminModule { }

