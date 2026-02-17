import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MilestonesService } from './application/services/milestones.service';
import { MilestonesController } from './presentation/controllers/milestones.controller';
import { Milestone } from './infrastructure/entities/milestone.entity';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { Assignment } from '../assignments/infrastructure/entities/assignment.entity';
import { Evidence } from '../evidences/infrastructure/entities/evidence.entity';
import { AssignmentsModule } from '../assignments/assignments.module';
import { EvidencesModule } from '../evidences/evidences.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Milestone, Project, Assignment, Evidence]),
    AssignmentsModule,
    EvidencesModule,
  ],
  controllers: [MilestonesController],
  providers: [MilestonesService],
})
export class MilestonesModule {}
