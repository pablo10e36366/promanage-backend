import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateFileDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateContentDto {
  @IsString()
  content: string;
}

