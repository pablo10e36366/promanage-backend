import { IsIn } from 'class-validator';

export class UpdateThreadStatusDto {
  @IsIn(['answered', 'unanswered'])
  status!: 'answered' | 'unanswered';
}
