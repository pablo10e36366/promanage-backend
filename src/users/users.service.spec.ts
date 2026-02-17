import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './application/services/users.service';
import { User } from './infrastructure/entities/user.entity';
import { RolesService } from '../roles/application/services/roles.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUsersRepo: Partial<Repository<User>>;
  let mockRolesService: Partial<RolesService>;

  beforeEach(async () => {
    mockUsersRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    mockRolesService = {
      findByName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepo,
        },
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

