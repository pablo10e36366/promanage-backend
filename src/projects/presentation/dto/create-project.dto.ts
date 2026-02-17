import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUrl,
} from 'class-validator';
import { ProjectStatus } from '../../domain/project-status';

export class CreateProjectDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsUrl()
  repositoryUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
