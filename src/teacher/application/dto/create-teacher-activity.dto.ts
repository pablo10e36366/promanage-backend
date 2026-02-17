import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeacherActivityDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  type?: string | null;

  @IsOptional()
  @IsDateString()
  deadline?: string | null;
}
