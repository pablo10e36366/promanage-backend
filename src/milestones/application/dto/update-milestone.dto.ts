import { PartialType } from '@nestjs/mapped-types';
import { CreateMilestoneDto } from './create-milestone.dto';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { MilestoneStatus } from '../../infrastructure/entities/milestone.entity';

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {
  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}
