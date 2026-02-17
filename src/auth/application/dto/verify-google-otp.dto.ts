import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class VerifyGoogleOtpDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;

  @IsString()
  @MinLength(6)
  password: string;
}
