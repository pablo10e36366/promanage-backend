import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';

export enum ShareAction {
  SHARE = 'share',
  SCHEDULE = 'schedule',
}

export class ShareProjectDto {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsEnum(ShareAction)
  action: ShareAction;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
