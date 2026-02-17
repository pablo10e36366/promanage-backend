import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { UpdateSettingsDto } from '../dto/admin-project.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class UpdateSettingsUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(dto: UpdateSettingsDto, actor: User) {
    return this.adminService.updateSettings(dto, actor);
  }
}


