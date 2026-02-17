import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EvidenceStatus } from '../../domain/evidence.enums';

export class ReviewEvidenceDto {
  @IsEnum(EvidenceStatus)
  status: EvidenceStatus;

  @IsOptional()
  @IsString()
  feedback?: string;
}

