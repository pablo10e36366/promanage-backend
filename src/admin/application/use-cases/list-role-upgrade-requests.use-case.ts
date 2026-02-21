import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { RoleUpgradeRequestStatus } from '../../../users/infrastructure/entities/role-upgrade-request.entity';

type ListRoleUpgradeRequestsFilters = {
  status?: RoleUpgradeRequestStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ListRoleUpgradeRequestsUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(filters?: ListRoleUpgradeRequestsFilters) {
    return this.adminService.listRoleUpgradeRequests(filters);
  }
}
