import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class TeacherSubmissionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 10;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'approved', 'changes_requested', 'all'])
  status?: string = 'pending';

  @IsOptional()
  @IsUUID()
  course_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  student_id?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  @IsIn(['created_at_desc', 'created_at_asc', 'priority_desc'])
  sort?: string = 'priority_desc';
}
