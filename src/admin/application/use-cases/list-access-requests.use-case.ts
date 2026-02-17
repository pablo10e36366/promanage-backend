import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { AccessStatus } from '../../../project-access/infrastructure/entities/project-access.entity';

type ListAccessRequestsFilters = {
  status?: AccessStatus;
  courseId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ListAccessRequestsUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(filters?: ListAccessRequestsFilters) {
    return this.adminService.listAccessRequests(filters);
  }
}
