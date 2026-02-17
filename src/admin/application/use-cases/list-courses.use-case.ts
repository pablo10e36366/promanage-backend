import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { ProjectStatus } from '../../../projects/infrastructure/entities/project.entity';

type ListCoursesFilters = {
  status?: ProjectStatus;
  ownerId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ListCoursesUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(filters?: ListCoursesFilters) {
    return this.adminService.findAllCourses(filters);
  }
}
