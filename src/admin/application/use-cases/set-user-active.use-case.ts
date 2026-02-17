import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { BlockUserDto } from '../dto/user-admin.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class SetUserActiveUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(userId: number, dto: BlockUserDto, actor: User) {
    return this.adminService.blockUser(userId, dto, actor);
  }
}


