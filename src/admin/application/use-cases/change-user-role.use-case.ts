import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { ChangeRoleDto } from '../dto/user-admin.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class ChangeUserRoleUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(userId: number, dto: ChangeRoleDto, actor: User) {
    return this.adminService.changeRole(userId, dto, actor);
  }
}


