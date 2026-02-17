import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class TeacherActivityFeedQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([
    'submission_created',
    'submission_reviewed',
    'thread_created',
    'reply_created',
    'announcement_created',
  ])
  type?:
    | 'submission_created'
    | 'submission_reviewed'
    | 'thread_created'
    | 'reply_created'
    | 'announcement_created';
}
