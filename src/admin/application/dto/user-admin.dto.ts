import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsNumber,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsNumber()
  roleId: number;
}

export class ChangeRoleDto {
  @IsNumber()
  roleId: number;
}

export class BlockUserDto {
  isActive: boolean;
}
