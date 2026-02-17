import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Milestone } from '../../infrastructure/entities/milestone.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { Assignment } from '../../../assignments/infrastructure/entities/assignment.entity';
import {
  Evidence,
  EvidenceStatus,
  EvidenceType,
} from '../../../evidences/infrastructure/entities/evidence.entity';
import { AssignmentsService } from '../../../assignments/application/services/assignments.service';
import { EvidencesService } from '../../../evidences/application/services/evidences.service';

@Injectable()
export class MilestonesService {
  constructor(
    @InjectRepository(Milestone)
    private readonly milestonesRepo: Repository<Milestone>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Assignment)
    private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(Evidence)
    private readonly evidencesRepo: Repository<Evidence>,
    private readonly assignmentsService: AssignmentsService,
    private readonly evidencesService: EvidencesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createMilestoneDto: CreateMilestoneDto) {
    return undefined;
  }
}

