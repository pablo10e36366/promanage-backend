import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Assignment } from '../assignments/infrastructure/entities/assignment.entity';
import { ProjectAccess } from '../project-access/infrastructure/entities/project-access.entity';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { User } from '../users/infrastructure/entities/user.entity';
import { TeacherStatsService } from './application/services/stats.service';
import { TeacherCoursesService } from './application/services/teacher-courses.service';
import { TeacherDashboardService } from './application/services/teacher-dashboard.service';
import { TeacherActivityFeedService } from './application/services/teacher-activity-feed.service';
import { TeacherNotificationsService } from './application/services/teacher-notifications.service';
import { TeacherSubmissionsService } from './application/services/teacher-submissions.service';
import { TeacherThreadsService } from './application/services/teacher-threads.service';
import { TeacherProfileService } from './application/services/teacher-profile.service';
import { TeacherActivitiesService } from './application/services/teacher-activities.service';
import { TeacherApiExceptionFilter } from './presentation/filters/teacher-api-exception.filter';
import { TeacherCoursesController } from './presentation/controllers/teacher-courses.controller';
import { TeacherDashboardController } from './presentation/controllers/teacher-dashboard.controller';
import { TeacherActivityFeedController } from './presentation/controllers/teacher-activity-feed.controller';
import { TeacherNotificationsController } from './presentation/controllers/teacher-notifications.controller';
import { TeacherSubmissionsController } from './presentation/controllers/teacher-submissions.controller';
import { TeacherThreadsController } from './presentation/controllers/teacher-threads.controller';
import { TeacherProfileController } from './presentation/controllers/teacher-profile.controller';
import { TeacherActivitiesController } from './presentation/controllers/teacher-activities.controller';
import { ActivityFeedEvent } from './infrastructure/entities/activity-feed-event.entity';
import { CourseStats } from './infrastructure/entities/course-stats.entity';
import { SubmissionReview } from './infrastructure/entities/submission-review.entity';
import { TeacherStats } from './infrastructure/entities/teacher-stats.entity';
import { ThreadReply } from './infrastructure/entities/thread-reply.entity';
import { Thread } from './infrastructure/entities/thread.entity';
import { Milestone } from '../milestones/infrastructure/entities/milestone.entity';
import { Evidence } from '../evidences/infrastructure/entities/evidence.entity';
import { RefreshToken } from '../auth/infrastructure/entities/refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectAccess,
      Assignment,
      User,
      Milestone,
      Evidence,
      ActivityFeedEvent,
      CourseStats,
      TeacherStats,
      RefreshToken,
      SubmissionReview,
      Thread,
      ThreadReply,
    ]),
  ],
  controllers: [
    TeacherCoursesController,
    TeacherActivitiesController,
    TeacherActivityFeedController,
    TeacherDashboardController,
    TeacherNotificationsController,
    TeacherSubmissionsController,
    TeacherThreadsController,
    TeacherProfileController,
  ],
  providers: [
    TeacherApiExceptionFilter,
    TeacherStatsService,
    TeacherActivitiesService,
    TeacherActivityFeedService,
    TeacherCoursesService,
    TeacherDashboardService,
    TeacherNotificationsService,
    TeacherSubmissionsService,
    TeacherThreadsService,
    TeacherProfileService,
  ],
  exports: [TeacherStatsService],
})
export class TeacherModule {}

