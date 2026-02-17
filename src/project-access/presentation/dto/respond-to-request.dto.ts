import { IsEnum, IsString, IsOptional } from 'class-validator';

export class RespondToRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  action: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  notes?: string;
}

