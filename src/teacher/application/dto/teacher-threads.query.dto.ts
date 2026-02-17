import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class TeacherThreadsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['unanswered', 'answered', 'all'])
  status?: 'unanswered' | 'answered' | 'all' = 'unanswered';

  @IsOptional()
  @IsUUID()
  course_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(['created_at_desc', 'created_at_asc'])
  sort?: 'created_at_desc' | 'created_at_asc' = 'created_at_desc';
}
