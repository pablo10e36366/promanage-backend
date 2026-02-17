import { IsEnum, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ProjectStatus } from '../../../projects/domain/project-status';

export class ForceStatusDto {
  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @IsString()
  reason: string;
}

export class ArchiveProjectDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  storageLimit?: number;

  @IsOptional()
  @IsString()
  allowedFileTypes?: string;

  @IsOptional()
  maxReviewDays?: number;

  @IsOptional()
  @IsBoolean()
  auditLogsEnabled?: boolean;
}
