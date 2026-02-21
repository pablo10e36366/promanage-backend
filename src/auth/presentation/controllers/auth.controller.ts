import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { LoginDto } from '../../application/dto/login.dto';
import { RegisterDto } from '../../application/dto/register.dto';
import { RefreshDto } from '../../application/dto/refresh.dto';
import { LogoutDto } from '../../application/dto/logout.dto';
import { StartGoogleOtpDto } from '../../application/dto/start-google-otp.dto';
import { VerifyGoogleOtpDto } from '../../application/dto/verify-google-otp.dto';
import { VerifyRegistrationDto } from '../../application/dto/verify-registration.dto';
import { ResendRegistrationPinDto } from '../../application/dto/resend-registration-pin.dto';
import { Public } from '../decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'] || null,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || null,
    });
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  verifyRegister(@Body() dto: VerifyRegistrationDto, @Req() req: Request) {
    return this.authService.verifyRegistration(dto, {
      userAgent: req.headers['user-agent'] || null,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || null,
    });
  }

  @Public()
  @Post('register/resend')
  @HttpCode(HttpStatus.OK)
  resendRegisterPin(@Body() dto: ResendRegistrationPinDto) {
    return this.authService.resendRegistrationPin(dto);
  }

  @Public()
  @Post('google-otp/start')
  @HttpCode(HttpStatus.OK)
  startGoogleOtp(@Body() dto: StartGoogleOtpDto) {
    return this.authService.startGoogleOtp(dto);
  }

  @Public()
  @Post('google-otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyGoogleOtp(@Body() dto: VerifyGoogleOtpDto, @Req() req: Request) {
    return this.authService.verifyGoogleOtp(dto, {
      userAgent: req.headers['user-agent'] || null,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || null,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }
}

