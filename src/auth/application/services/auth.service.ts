import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';

import { User } from '../../../users/infrastructure/entities/user.entity';
import { Role } from '../../../roles/infrastructure/entities/role.entity';
import { RoleType } from '../../../roles/domain/permissions';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshToken } from '../../infrastructure/entities/refresh-token.entity';
import { RefreshDto } from '../dto/refresh.dto';
import { LogoutDto } from '../dto/logout.dto';
import { StartGoogleOtpDto } from '../dto/start-google-otp.dto';
import { VerifyGoogleOtpDto } from '../dto/verify-google-otp.dto';
import { VerifyRegistrationDto } from '../dto/verify-registration.dto';
import { ResendRegistrationPinDto } from '../dto/resend-registration-pin.dto';
import { EmailOtp } from '../../infrastructure/entities/email-otp.entity';
import { PendingRegistration } from '../../infrastructure/entities/pending-registration.entity';
import { MailService } from '../../../mail/application/services/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepo: Repository<RefreshToken>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(EmailOtp)
    private readonly emailOtpRepo: Repository<EmailOtp>,
    @InjectRepository(PendingRegistration)
    private readonly pendingRegistrationRepo: Repository<PendingRegistration>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const name = String(dto.name || '').trim();
    const email = String(dto.email || '').trim().toLowerCase();
    const password = String(dto.password || '').trim();

    if (!name) {
      throw new BadRequestException('Name is required');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const existingPending = await this.pendingRegistrationRepo.findOne({
      where: {
        email,
        consumedAt: IsNull(),
      } as any,
      order: { createdAt: 'DESC' as any },
    });

    const now = Date.now();
    if (existingPending?.lastSentAt) {
      const diff = now - existingPending.lastSentAt.getTime();
      if (diff < 60_000) {
        throw new HttpException(
          'Espera un momento antes de solicitar otro codigo',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyCode = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(verifyCode, 10);
    const tokenHash = createHash('sha256')
      .update(randomBytes(32).toString('hex'))
      .digest('hex');
    const expiresAt = new Date(now + 24 * 60 * 60_000);

    if (existingPending) {
      const merged = this.pendingRegistrationRepo.merge(existingPending, {
        name,
        passwordHash,
        codeHash,
        tokenHash,
        attempts: 0,
        expiresAt,
        lastSentAt: new Date(),
      });
      await this.pendingRegistrationRepo.save(merged);
    } else {
      const created = this.pendingRegistrationRepo.create({
        email,
        name,
        passwordHash,
        codeHash,
        tokenHash,
        expiresAt,
        consumedAt: null,
        attempts: 0,
        lastSentAt: new Date(),
      } as any);
      await this.pendingRegistrationRepo.save(created);
    }

    await this.mailService.sendRegistrationVerificationEmail(
      email,
      name,
      verifyCode,
    );

    return {
      success: true,
      message: 'Revisa tu correo e ingresa el PIN de 6 digitos para activar tu cuenta',
      expires_in_seconds: 86400,
    };
  }

  async verifyRegistration(
    dto: VerifyRegistrationDto,
    ctx?: { userAgent?: string | null; ipAddress?: string | null },
  ) {
    const email = String(dto.email || '').trim().toLowerCase();
    const code = String(dto.code || '').trim();
    const pending = await this.pendingRegistrationRepo.findOne({
      where: {
        email,
        consumedAt: IsNull(),
      } as any,
      order: { createdAt: 'DESC' as any },
    });

    if (!pending) {
      throw new UnauthorizedException('Codigo invalido');
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Codigo expirado');
    }

    if (pending.attempts >= 5) {
      throw new UnauthorizedException('Demasiados intentos');
    }

    const ok = await bcrypt.compare(code, pending.codeHash);
    if (!ok) {
      await this.pendingRegistrationRepo.update(
        { id: pending.id },
        { attempts: pending.attempts + 1 } as any,
      );
      throw new UnauthorizedException('Codigo invalido');
    }

    const existingUser = await this.userRepository.findOne({ where: { email: pending.email } });
    if (existingUser) {
      throw new ConflictException('Este correo ya esta registrado. Inicia sesion.');
    }

    let defaultRole = await this.roleRepository.findOne({
      where: { name: RoleType.STUDENT },
    });
    if (!defaultRole) {
      defaultRole = this.roleRepository.create({
        name: RoleType.STUDENT,
        description: 'Colaborador (Estudiante)',
      });
      await this.roleRepository.save(defaultRole);
    }

    const user = this.userRepository.create({
      email: pending.email,
      name: pending.name,
      password: pending.passwordHash,
      role: defaultRole,
    });
    await this.userRepository.save(user);

    await this.pendingRegistrationRepo.update(
      { id: pending.id },
      { consumedAt: new Date() } as any,
    );

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name ? String(user.role.name).toLowerCase() : 'usuario',
    };

    const access_token = this.jwtService.sign(payload);
    const refresh_token = await this.issueRefreshToken(user.id, ctx);

    return {
      access_token,
      refresh_token,
      user: payload,
    };
  }

  async resendRegistrationPin(dto: ResendRegistrationPinDto) {
    const email = String(dto.email || '').trim().toLowerCase();
    const pending = await this.pendingRegistrationRepo.findOne({
      where: {
        email,
        consumedAt: IsNull(),
      } as any,
      order: { createdAt: 'DESC' as any },
    });

    if (!pending) {
      throw new BadRequestException(
        'No existe un registro pendiente para este correo. Primero completa el registro.',
      );
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('El PIN de registro ha expirado. Vuelve a registrarte.');
    }

    const now = Date.now();
    if (pending.lastSentAt) {
      const diff = now - pending.lastSentAt.getTime();
      if (diff < 60_000) {
        throw new HttpException(
          'Espera un momento antes de solicitar otro codigo',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const verifyCode = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(verifyCode, 10);

    await this.pendingRegistrationRepo.update(
      { id: pending.id },
      {
        codeHash,
        attempts: 0,
        lastSentAt: new Date(),
      } as any,
    );

    await this.mailService.sendRegistrationVerificationEmail(
      pending.email,
      pending.name,
      verifyCode,
    );

    return {
      success: true,
      message: 'Te enviamos un nuevo PIN de verificacion a tu correo',
      cooldown_seconds: 60,
    };
  }

  async login(
    dto: LoginDto,
    ctx?: { userAgent?: string | null; ipAddress?: string | null },
  ) {
    const { email, password } = dto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email })
      .select([
        'user.id',
        'user.email',
        'user.name',
        'user.password',
        'role.id',
        'role.name',
      ])
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name ? String(user.role.name).toLowerCase() : 'usuario',
    };

    const access_token = this.jwtService.sign(payload);
    const refresh_token = await this.issueRefreshToken(user.id, ctx);

    return {
      access_token,
      refresh_token,
      user: payload,
    };
  }

  async startGoogleOtp(dto: StartGoogleOtpDto) {
    const email = String(dto.email || '').trim().toLowerCase();
    if (!email.endsWith('@gmail.com')) {
      throw new BadRequestException('Solo se permite correo @gmail.com');
    }

    const userExists = await this.userRepository.findOne({ where: { email } });
    if (userExists) {
      throw new ConflictException('Este correo ya está registrado. Inicia sesión.');
    }

    const existing = await this.emailOtpRepo.findOne({
      where: {
        email,
        purpose: 'google_register',
        consumedAt: IsNull(),
      } as any,
      order: { createdAt: 'DESC' as any },
    });

    const now = Date.now();
    if (existing?.lastSentAt) {
      const diff = now - existing.lastSentAt.getTime();
      if (diff < 60_000) {
        throw new HttpException(
          'Espera un momento antes de solicitar otro código',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(now + 10 * 60_000);

    if (existing) {
      const merged = this.emailOtpRepo.merge(existing, {
        codeHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      });
      await this.emailOtpRepo.save(merged);
    } else {
      const created = this.emailOtpRepo.create({
        email,
        purpose: 'google_register',
        codeHash,
        expiresAt,
        consumedAt: null,
        attempts: 0,
        lastSentAt: new Date(),
      } as any);
      await this.emailOtpRepo.save(created);
    }

    await this.mailService.sendGoogleOtpEmail(email, code);

    return {
      success: true,
      expires_in_seconds: 600,
      cooldown_seconds: 60,
    };
  }

  async verifyGoogleOtp(
    dto: VerifyGoogleOtpDto,
    ctx?: { userAgent?: string | null; ipAddress?: string | null },
  ) {
    const email = String(dto.email || '').trim().toLowerCase();
    const code = String(dto.code || '').trim();
    const password = String(dto.password || '').trim();
    if (!email.endsWith('@gmail.com')) {
      throw new BadRequestException('Solo se permite correo @gmail.com');
    }
    if (!password || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const record = await this.emailOtpRepo.findOne({
      where: {
        email,
        purpose: 'google_register',
        consumedAt: IsNull(),
      } as any,
      order: { createdAt: 'DESC' as any },
    });

    if (!record) {
      throw new UnauthorizedException('Código inválido');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Código expirado');
    }

    if (record.attempts >= 5) {
      throw new UnauthorizedException('Demasiados intentos');
    }

    const ok = await bcrypt.compare(code, record.codeHash);
    if (!ok) {
      await this.emailOtpRepo.update(
        { id: record.id },
        { attempts: record.attempts + 1 } as any,
      );
      throw new UnauthorizedException('Código inválido');
    }

    await this.emailOtpRepo.update(
      { id: record.id },
      { consumedAt: new Date() } as any,
    );

    let user = await this.userRepository.findOne({
      where: { email },
      relations: ['role'],
    });
    if (user) {
      throw new ConflictException('Este correo ya está registrado. Inicia sesión.');
    }

    let defaultRole = await this.roleRepository.findOne({
      where: { name: RoleType.STUDENT },
    });
    if (!defaultRole) {
      defaultRole = this.roleRepository.create({
        name: RoleType.STUDENT,
        description: 'Colaborador (Estudiante)',
      });
      await this.roleRepository.save(defaultRole);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const nameFromEmail = email.split('@')[0];
    user = this.userRepository.create({
      email,
      name: nameFromEmail,
      password: hashedPassword,
      role: defaultRole,
    });
    await this.userRepository.save(user);

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name ? String(user.role.name).toLowerCase() : 'usuario',
    };

    const access_token = this.jwtService.sign(payload);
    const refresh_token = await this.issueRefreshToken(user.id, ctx);

    return {
      access_token,
      refresh_token,
      user: payload,
    };
  }

  async refresh(dto: RefreshDto) {
    const { refresh_token } = dto;
    const { tokenId, secret } = this.parseRefreshToken(refresh_token);

    const record = await this.refreshTokensRepo.findOne({
      where: { id: tokenId },
    });
    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.revokedAt) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const ok = await bcrypt.compare(secret, record.tokenHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: record.userId },
      relations: ['role'],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name ? String(user.role.name).toLowerCase() : 'usuario',
    };

    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }

  async logout(dto: LogoutDto) {
    const { refresh_token } = dto;
    const { tokenId } = this.parseRefreshToken(refresh_token);

    await this.refreshTokensRepo.update(
      { id: tokenId },
      { revokedAt: new Date() },
    );

    return { success: true };
  }

  private parseRefreshToken(token: string): { tokenId: string; secret: string } {
    const raw = (token || '').trim();
    const parts = raw.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const [tokenId, secret] = parts;
    if (!tokenId || !secret) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { tokenId, secret };
  }

  private async issueRefreshToken(
    userId: number,
    ctx?: { userAgent?: string | null; ipAddress?: string | null },
  ): Promise<string> {
    const tokenId = randomUUID();
    const secret = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(secret, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const record = this.refreshTokensRepo.create({
      id: tokenId,
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      userAgent: ctx?.userAgent ?? null,
      ipAddress: ctx?.ipAddress ?? null,
    } as any);

    await this.refreshTokensRepo.save(record);
    return `${tokenId}.${secret}`;
  }
}

