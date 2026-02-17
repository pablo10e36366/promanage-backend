import { IsEmail, IsString } from 'class-validator';

export class StartGoogleOtpDto {
  @IsString()
  @IsEmail()
  email: string;
}

