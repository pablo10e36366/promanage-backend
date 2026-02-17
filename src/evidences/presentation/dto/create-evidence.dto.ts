import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { EvidenceType } from '../../domain/evidence.enums';

export class CreateEvidenceDto {
  @IsUUID()
  milestoneId: string;

  @ValidateIf((o: CreateEvidenceDto) => o.type === EvidenceType.LINK)
  @IsUrl(
    { require_protocol: true },
    { message: 'URL debe ser válida para tipo LINK' },
  )
  url?: string;

  @ValidateIf((o: CreateEvidenceDto) => o.type === EvidenceType.TEXT)
  @IsString({ message: 'Description es requerida para tipo TEXT' })
  description?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsEnum(EvidenceType)
  type: EvidenceType;

  // Nuevos campos para FileSystem & Editor
  @IsOptional()
  @IsBoolean()
  isFolder?: boolean;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  contentBlob?: string | null; // HTML or JSON content

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  // Campo opcional para asociar con Assignment
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}

