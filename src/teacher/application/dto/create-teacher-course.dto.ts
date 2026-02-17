import { IsOptional, IsString, Length } from 'class-validator';

export class CreateTeacherCourseDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 10)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
