import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';

@Injectable()
export class GetSettingsUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute() {
    return this.adminService.getSettings();
  }
}
