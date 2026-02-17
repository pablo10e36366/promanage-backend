import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ProjectPermission } from '../../infrastructure/entities/project-access.entity';

export class RequestAccessDto {
  @IsEnum(ProjectPermission)
  permission: ProjectPermission;

  @IsOptional()
  @IsString()
  notes?: string;
}

