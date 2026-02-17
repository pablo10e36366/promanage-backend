import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidencesService } from './application/services/evidences.service';
import { EvidencesController } from './presentation/controllers/evidences.controller';
import { Evidence } from './infrastructure/entities/evidence.entity';
import { Milestone } from '../milestones/infrastructure/entities/milestone.entity';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { Assignment } from '../assignments/infrastructure/entities/assignment.entity';
import { ActivityModule } from '../activity/activity.module';
import { AssignmentsModule } from '../assignments/assignments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evidence, Milestone, Project, Assignment]),
    ActivityModule,
    AssignmentsModule,
  ],
  controllers: [EvidencesController],
  providers: [EvidencesService],
  exports: [EvidencesService],
})
export class EvidencesModule {}

