import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { AuthService } from './application/services/auth.service';
import { User } from '../users/infrastructure/entities/user.entity';
import { Role } from '../roles/infrastructure/entities/role.entity';
import { RefreshToken } from './infrastructure/entities/refresh-token.entity';
import { EmailOtp } from './infrastructure/entities/email-otp.entity';
import { MailService } from '../mail/application/services/mail.service';
import { RoleType } from '../roles/domain/permissions';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const userRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const refreshTokensRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const roleRepo = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };

  const emailOtpRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn(() => 'access.jwt.token'),
  };

  const mailService = {
    sendGoogleOtpEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokensRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(EmailOtp), useValue: emailOtpRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('crea usuario colaborador cuando email no existe', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      roleRepo.findOne.mockResolvedValueOnce({
        id: 3,
        name: RoleType.STUDENT,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pass');
      userRepo.create.mockReturnValue({
        id: 7,
        name: 'Nuevo',
        email: 'nuevo@gmail.com',
        password: 'hashed-pass',
        role: { id: 3, name: RoleType.STUDENT },
      });
      userRepo.save.mockResolvedValue({
        id: 7,
        name: 'Nuevo',
        email: 'nuevo@gmail.com',
        role: { id: 3, name: RoleType.STUDENT },
      });

      const result = await service.register({
        name: 'Nuevo',
        email: 'nuevo@gmail.com',
        password: '123456',
      });

      expect(result).toEqual({
        id: 7,
        name: 'Nuevo',
        email: 'nuevo@gmail.com',
        role: RoleType.STUDENT,
      });
      expect(userRepo.create).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('lanza ConflictException cuando email ya existe', async () => {
      userRepo.findOne.mockResolvedValueOnce({ id: 1, email: 'dup@gmail.com' });

      await expect(
        service.register({
          name: 'Dup',
          email: 'dup@gmail.com',
          password: '123456',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lanza BadRequestException para password corto', async () => {
      await expect(
        service.register({
          name: 'Short',
          email: 'short@gmail.com',
          password: '123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('login', () => {
    function mockQueryBuilder(user: unknown) {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);
    }

    it('retorna access y refresh token con credenciales vÃ¡lidas', async () => {
      const mockUser = {
        id: 10,
        name: 'Docente',
        email: 'docente@promanage.com',
        password: '$hash',
        role: { name: 'docente' },
      };
      mockQueryBuilder(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'docente@promanage.com',
        password: '12345678',
      });

      expect(result.access_token).toBe('access.jwt.token');
      expect(typeof result.refresh_token).toBe('string');
      expect(result.refresh_token.includes('.')).toBe(true);
      expect(result.user).toEqual({
        sub: 10,
        email: 'docente@promanage.com',
        name: 'Docente',
        role: 'docente',
      });
      expect(refreshTokensRepo.save).toHaveBeenCalled();
    });

    it('lanza UnauthorizedException cuando usuario no existe', async () => {
      mockQueryBuilder(null);

      await expect(
        service.login({
          email: 'missing@promanage.com',
          password: '12345678',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza UnauthorizedException cuando password no coincide', async () => {
      mockQueryBuilder({
        id: 10,
        name: 'Docente',
        email: 'docente@promanage.com',
        password: '$hash',
        role: { name: 'docente' },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'docente@promanage.com',
          password: 'bad',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

