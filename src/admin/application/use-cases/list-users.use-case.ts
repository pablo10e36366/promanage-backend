import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';

type ListUsersFilters = {
  status?: 'active' | 'blocked';
  roleId?: number;
  search?: string;
};

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(filters?: ListUsersFilters) {
    return this.adminService.findAllUsers(filters);
  }
}
