import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class ReviewSubmissionDto {
  @IsString()
  @IsIn(['approved', 'changes_requested'])
  status: 'approved' | 'changes_requested';

  @IsString()
  @Length(0, 5000)
  feedback: string;

  @IsOptional()
  @IsObject()
  rubric_scores?: Record<string, unknown>;
}
