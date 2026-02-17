import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './application/services/auth.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './infrastructure/security/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/infrastructure/entities/user.entity';
import { AuthValidationService } from './application/services/auth-validation.service';
import { RefreshToken } from './infrastructure/entities/refresh-token.entity';
import { Role } from '../roles/infrastructure/entities/role.entity';
import { EmailOtp } from './infrastructure/entities/email-otp.entity';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MailModule,
    TypeOrmModule.forFeature([User, RefreshToken, Role, EmailOtp]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, AuthValidationService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, AuthValidationService],
})
export class AuthModule { }

