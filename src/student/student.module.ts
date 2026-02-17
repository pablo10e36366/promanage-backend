import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from '../projects/infrastructure/entities/project.entity';
import { ProjectAccess } from '../project-access/infrastructure/entities/project-access.entity';
import { Assignment } from '../assignments/infrastructure/entities/assignment.entity';
import { Milestone } from '../milestones/infrastructure/entities/milestone.entity';
import { ProjectAccessModule } from '../project-access/project-access.module';
import { RefreshToken } from '../auth/infrastructure/entities/refresh-token.entity';
import { ActivityFeedEvent } from '../teacher/infrastructure/entities/activity-feed-event.entity';

import { StudentCoursesController } from './presentation/controllers/student-courses.controller';
import { StudentAssignmentsController } from './presentation/controllers/student-assignments.controller';
import { StudentDashboardController } from './presentation/controllers/student-dashboard.controller';
import { StudentNotificationsController } from './presentation/controllers/student-notifications.controller';
import { StudentCoursesService } from './application/services/student-courses.service';
import { StudentAssignmentsService } from './application/services/student-assignments.service';
import { StudentDashboardService } from './application/services/student-dashboard.service';
import { StudentNotificationsService } from './application/services/student-notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectAccess,
      Assignment,
      Milestone,
      RefreshToken,
      ActivityFeedEvent,
    ]),
    ProjectAccessModule,
  ],
  controllers: [
    StudentCoursesController,
    StudentAssignmentsController,
    StudentDashboardController,
    StudentNotificationsController,
  ],
  providers: [
    StudentCoursesService,
    StudentAssignmentsService,
    StudentDashboardService,
    StudentNotificationsService,
  ],
})
export class StudentModule {}

