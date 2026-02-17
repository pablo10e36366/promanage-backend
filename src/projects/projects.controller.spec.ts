import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './presentation/controllers/projects.controller';
import { ProjectsService } from './application/services/projects.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let mockProjectsService: Partial<ProjectsService>;

  beforeEach(async () => {
    mockProjectsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      getResumen: jest.fn(),
      findAllByUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
