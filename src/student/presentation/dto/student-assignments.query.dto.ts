import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';
import { AssignmentStatus } from '../../../assignments/domain/assignment-status';

export class StudentAssignmentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  course_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(AssignmentStatus))
  status?: AssignmentStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  @IsIn(['created_at_desc', 'created_at_asc', 'deadline_asc', 'deadline_desc'])
  sort?: string;
}

