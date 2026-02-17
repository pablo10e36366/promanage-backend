import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTeacherProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  avatar_color?: string;
}
