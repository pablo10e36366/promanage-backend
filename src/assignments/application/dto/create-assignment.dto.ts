import { IsUUID, IsInt, IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { AssignmentStatus } from '../../domain/assignment-status';

export class CreateAssignmentDto {
  @IsUUID()
  projectId: string;

  @IsUUID()
  @IsOptional()
  milestoneId?: string;

  @IsInt()
  studentId: number;

  @IsUUID()
  @IsOptional()
  evidenceId?: string;

  @IsEnum(AssignmentStatus)
  @IsOptional()
  status?: AssignmentStatus = AssignmentStatus.PENDIENTE;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  feedback?: string;
}
