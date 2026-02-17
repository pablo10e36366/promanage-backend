import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { CreateUserDto } from '../dto/user-admin.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(dto: CreateUserDto, actor: User) {
    return this.adminService.createUser(dto, actor);
  }
}


