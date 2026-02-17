import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class TeacherCoursesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['last_activity_desc', 'title_asc', 'title_desc'])
  sort?: string;
}
