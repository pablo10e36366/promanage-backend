import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveRoleUpgradeRequestDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT'])
  decision: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  notes?: string;
}
