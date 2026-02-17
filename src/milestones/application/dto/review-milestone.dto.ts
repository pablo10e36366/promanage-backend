import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ReviewMilestoneDto {
  @IsString()
  @IsOptional()
  feedback?: string;

  @IsBoolean()
  approved: boolean;
}
