import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EvidencesService } from './application/services/evidences.service';
import {
  Evidence,
  EvidenceStatus,
  EvidenceType,
} from './infrastructure/entities/evidence.entity';
import { Milestone, MilestoneStatus } from '../milestones/infrastructure/entities/milestone.entity';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { User } from '../users/infrastructure/entities/user.entity';
import { CreateEvidenceDto } from './presentation/dto/create-evidence.dto';
import { ReviewEvidenceDto } from './presentation/dto/review-evidence.dto';
import { ActivityService } from '../activity/application/services/activity.service';
import { AssignmentsService } from '../assignments/application/services/assignments.service';
import { Assignment } from '../assignments/infrastructure/entities/assignment.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('EvidencesService', () => {
  let service: EvidencesService;
  let evidencesRepo: Repository<Evidence>;
  let milestonesRepo: Repository<Milestone>;
  let dataSource: DataSource;

  const mockUser: User = {
    id: 1,
    email: 'student@example.com',
    name: 'Student',
    password: 'hashed',
    role: { id: 1, name: 'colaborador' } as any,
  } as unknown as User;

  const mockMilestone: Milestone = {
    id: 'milestone-1',
    title: 'Milestone 1',
    description: 'Desc',
    dueDate: new Date(),
    status: MilestoneStatus.PENDING,
    project: { id: 'project-1' } as unknown as Project,
    order: 1,
  } as unknown as Milestone;

  const mockEvidence: Evidence = {
    id: 'evidence-1',
    milestone: mockMilestone,
    author: mockUser,
    type: EvidenceType.LINK,
    url: 'https://example.com',
    description: '',
    title: 'Test',
    status: EvidenceStatus.SUBMITTED,
    feedback: null,
    isFolder: false,
  } as unknown as Evidence;

  const makeQueryRunner = () => {
    const manager = {
      save: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
    };
    return {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
  };

  beforeEach(async () => {
    const queryRunner = makeQueryRunner();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidencesService,
        {
          provide: getRepositoryToken(Evidence),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Milestone),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Assignment),
          useValue: {},
        },
        {
          provide: ActivityService,
          useValue: { logActivity: jest.fn() },
        },
        {
          provide: AssignmentsService,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn(() => queryRunner) },
        },
      ],
    }).compile();

    service = module.get(EvidencesService);
    evidencesRepo = module.get(getRepositoryToken(Evidence));
    milestonesRepo = module.get(getRepositoryToken(Milestone));
    dataSource = module.get(DataSource);

    // Expose queryRunner for tests
    (dataSource.createQueryRunner as any).__queryRunner = queryRunner;
  });

  const getQueryRunner = () =>
    ((dataSource.createQueryRunner as any).__queryRunner as ReturnType<
      typeof makeQueryRunner
    >);

  describe('submit', () => {
    it('should create evidence and change milestone status to IN_PROGRESS if first evidence', async () => {
      const dto: CreateEvidenceDto = {
        milestoneId: 'milestone-1',
        type: EvidenceType.LINK,
        url: 'https://example.com',
        title: 'Test',
      };

      jest.spyOn(milestonesRepo, 'findOne').mockResolvedValue(mockMilestone);

      const qr = getQueryRunner();
      qr.manager.save
        .mockResolvedValueOnce(mockEvidence) // evidence
        .mockResolvedValueOnce({ ...mockMilestone, status: MilestoneStatus.IN_PROGRESS }); // milestone
      qr.manager.count.mockResolvedValue(1);

      const result = await service.submit(dto, mockUser);

      expect(result).toEqual(mockEvidence);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.manager.count).toHaveBeenCalledWith(Evidence, {
        where: { milestone: { id: mockMilestone.id } },
      });
      expect(qr.manager.save).toHaveBeenCalledWith({
        ...mockMilestone,
        status: MilestoneStatus.IN_PROGRESS,
      });
    });

    it('should throw NotFoundException if milestone does not exist', async () => {
      const dto: CreateEvidenceDto = {
        milestoneId: 'non-existent',
        type: EvidenceType.LINK,
        url: 'https://example.com',
      };

      jest.spyOn(milestonesRepo, 'findOne').mockResolvedValue(null);

      await expect(service.submit(dto, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should not change milestone status if not first evidence', async () => {
      const dto: CreateEvidenceDto = {
        milestoneId: 'milestone-1',
        type: EvidenceType.LINK,
        url: 'https://example.com',
      };

      jest.spyOn(milestonesRepo, 'findOne').mockResolvedValue(mockMilestone);

      const qr = getQueryRunner();
      qr.manager.save.mockResolvedValueOnce(mockEvidence);
      qr.manager.count.mockResolvedValue(5);

      await service.submit(dto, mockUser);

      // evidence save called once; no milestone save
      expect(qr.manager.save).toHaveBeenCalledTimes(1);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('review', () => {
    it('should update evidence and milestone if approved', async () => {
      const reviewDto: ReviewEvidenceDto = {
        status: EvidenceStatus.APPROVED,
        feedback: 'Good job',
      };

      const evidenceWithRelations: Evidence = {
        ...mockEvidence,
        milestone: {
          ...mockMilestone,
          project: {
            id: 'project-1',
            owner: { id: 2 } as unknown as User,
          } as unknown as Project,
        } as any,
      } as unknown as Evidence;

      jest.spyOn(evidencesRepo, 'findOne').mockResolvedValue(evidenceWithRelations);
      jest.spyOn(evidencesRepo, 'save').mockResolvedValue(evidenceWithRelations);
      jest.spyOn(milestonesRepo, 'save').mockResolvedValue(mockMilestone);

      const mentorUser: User = { ...mockUser, id: 2, role: { name: 'mentor' } as any } as any;
      const result = await service.review('evidence-1', reviewDto, mentorUser);

      expect(result).toEqual(evidenceWithRelations);
      expect(milestonesRepo.save).toHaveBeenCalledWith({
        ...evidenceWithRelations.milestone,
        status: MilestoneStatus.COMPLETED,
      });
    });

    it('should throw NotFoundException if evidence does not exist', async () => {
      jest.spyOn(evidencesRepo, 'findOne').mockResolvedValue(null);
      const reviewDto: ReviewEvidenceDto = { status: EvidenceStatus.APPROVED };
      await expect(service.review('invalid-id', reviewDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not project owner', async () => {
      const evidenceWithRelations: Evidence = {
        ...mockEvidence,
        milestone: {
          ...mockMilestone,
          project: { id: 'project-1', owner: { id: 999 } as any } as any,
        } as any,
      } as unknown as Evidence;

      jest.spyOn(evidencesRepo, 'findOne').mockResolvedValue(evidenceWithRelations);
      const reviewDto: ReviewEvidenceDto = { status: EvidenceStatus.APPROVED };
      await expect(service.review('evidence-1', reviewDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAllByMilestone', () => {
    it('should return evidences for milestone', async () => {
      const evidences = [mockEvidence];
      jest.spyOn(evidencesRepo, 'find').mockResolvedValue(evidences);

      const result = await service.findAllByMilestone('milestone-1');

      expect(evidencesRepo.find).toHaveBeenCalledWith({
        where: { milestone: { id: 'milestone-1' } },
        relations: ['author', 'milestone'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(evidences);
    });
  });
});

