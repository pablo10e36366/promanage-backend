import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from './application/services/projects.service';
import { Project, ProjectStatus } from './infrastructure/entities/project.entity';
import { User } from '../users/infrastructure/entities/user.entity';
import { Milestone } from '../milestones/infrastructure/entities/milestone.entity';
import { ActivityService } from '../activity/application/services/activity.service';
import {
  Evidence,
  EvidenceType,
  EvidenceStatus,
} from '../evidences/infrastructure/entities/evidence.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockProjectsRepo: Partial<Repository<Project>>;

  const mockUser: User = {
    id: 1,
    email: 'owner@example.com',
    name: 'Owner',
    password: 'hashed',
    role: { id: 1, name: 'usuario' },
    projects: [],
    evidences: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as User;

  const mockAdminUser: User = {
    ...mockUser,
    id: 2,
    role: { id: 2, name: 'admin' },
  } as unknown as User;

  const mockOtherUser: User = {
    ...mockUser,
    id: 3,
    role: { id: 1, name: 'usuario' },
  } as unknown as User;

  const mockEvidence: Evidence = {
    id: 'evidence-1',
    title: 'Test evidence',
    url: 'https://example.com',
    description: '',
    feedback: null,
    status: EvidenceStatus.SUBMITTED,
    type: EvidenceType.LINK,
    createdAt: new Date('2026-01-18T19:00:00Z'),
    updatedAt: new Date('2026-01-18T19:00:00Z'),
    milestone: {} as Milestone,
    author: mockUser,
  } as unknown as Evidence;

  const mockMilestone: Milestone = {
    id: 'milestone-1',
    title: 'Milestone 1',
    description: 'Desc',
    dueDate: new Date(),
    status: 'PENDING',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {} as Project,
    evidences: [mockEvidence],
  } as unknown as Milestone;

  const mockProject: Project = {
    id: 'project-1',
    title: 'Test Project',
    description: 'A test project',
    status: ProjectStatus.IN_PROGRESS,
    repositoryUrl: '',
    isPublic: false,
    createdAt: new Date('2026-01-18T18:00:00Z'),
    updatedAt: new Date('2026-01-18T20:00:00Z'),
    owner: mockUser,
    milestones: [mockMilestone],
  } as unknown as Project;

  beforeEach(async () => {
    mockProjectsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectsRepo,
        },
        {
          provide: ActivityService,
          useValue: {
            logActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRepositoryView', () => {
    it('should return repository view for owner', async () => {
      // Mock findOne to return project with relations
      jest.spyOn(mockProjectsRepo, 'findOne').mockResolvedValue(mockProject);

      const result = await service.getRepositoryView('project-1', mockUser);

      expect(mockProjectsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        relations: [
          'owner',
          'milestones',
          'milestones.evidences',
          'milestones.evidences.author',
        ],
      });

      // Verify structure
      expect(result).toHaveProperty('header');
      expect(result.header.title).toBe('Test Project');
      expect(result.header.owner).toBe('Owner');
      expect(result.header.status).toBe(ProjectStatus.IN_PROGRESS);
      expect(result.stats.commits).toBe(0);
      expect(result.stats.contributors).toBe(1);
      expect(result.stats.lastUpdate).toBe('now');
      expect(result.fileTree).toHaveLength(0);
      expect(result.readme).toBe('');
    });

    it('should return repository view for admin', async () => {
      jest.spyOn(mockProjectsRepo, 'findOne').mockResolvedValue(mockProject);

      const result = await service.getRepositoryView(
        'project-1',
        mockAdminUser,
      );

      expect(mockProjectsRepo.findOne).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      jest.spyOn(mockProjectsRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.getRepositoryView('non-existent', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner nor admin', async () => {
      jest.spyOn(mockProjectsRepo, 'findOne').mockResolvedValue(mockProject);

      await expect(
        service.getRepositoryView('project-1', mockOtherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle project with no evidences', async () => {
      const projectWithoutEvidences = {
        ...mockProject,
        milestones: [],
      };
      jest
        .spyOn(mockProjectsRepo, 'findOne')
        .mockResolvedValue(projectWithoutEvidences);

      const result = await service.getRepositoryView('project-1', mockUser);

      expect(result.stats.commits).toBe(0);
      expect(result.stats.contributors).toBe(1); // owner counts
      expect(result.fileTree).toHaveLength(0);
    });

    it('should calculate contributors correctly', async () => {
      const evidenceWithDifferentAuthor = {
        ...mockEvidence,
        author: { ...mockUser, id: 99, name: 'Another' },
      };
      const milestoneWithTwoEvidences = {
        ...mockMilestone,
        evidences: [mockEvidence, evidenceWithDifferentAuthor],
      };
      const projectWithMultipleEvidences = {
        ...mockProject,
        milestones: [milestoneWithTwoEvidences],
      };
      jest
        .spyOn(mockProjectsRepo, 'findOne')
        .mockResolvedValue(projectWithMultipleEvidences);

      const result = await service.getRepositoryView('project-1', mockUser);

      expect(result.stats.commits).toBe(0);
      expect(result.stats.contributors).toBe(1);
    });
  });
});

