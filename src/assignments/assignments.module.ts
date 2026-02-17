import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsController } from './presentation/controllers/assignments.controller';
import { AssignmentsService } from './application/services/assignments.service';
import { Assignment } from './infrastructure/entities/assignment.entity';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { Milestone } from '../milestones/infrastructure/entities/milestone.entity';
import { Evidence } from '../evidences/infrastructure/entities/evidence.entity';
import { User } from '../users/infrastructure/entities/user.entity';
import { ActivityFeedEvent } from '../teacher/infrastructure/entities/activity-feed-event.entity';
import { CourseStats } from '../teacher/infrastructure/entities/course-stats.entity';
import { SubmissionReview } from '../teacher/infrastructure/entities/submission-review.entity';
import { TeacherStats } from '../teacher/infrastructure/entities/teacher-stats.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Assignment,
      Project,
      Milestone,
      Evidence,
      User,
      ActivityFeedEvent,
      CourseStats,
      TeacherStats,
      SubmissionReview,
    ]),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}

