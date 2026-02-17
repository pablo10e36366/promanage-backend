import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class StudentCoursesQueryDto extends PaginationDto {
  // prefer `q` but accept `search` for flexibility
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

