import { IsEmail, IsString } from 'class-validator';

export class ResendRegistrationPinDto {
  @IsString()
  @IsEmail()
  email: string;
}
