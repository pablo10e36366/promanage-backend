import { IsEnum } from 'class-validator';
import { ProjectPermission } from '../../infrastructure/entities/project-access.entity';

export class ChangePermissionDto {
  @IsEnum(ProjectPermission)
  permission: ProjectPermission;
}

