import { IsString, IsOptional } from 'class-validator';

export class ReviewAssignmentDto {
  @IsString()
  @IsOptional()
  feedback?: string;
}
