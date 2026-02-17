import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class DeleteCourseUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(courseId: string, actor: User) {
    return this.adminService.deleteCourse(courseId, actor);
  }
}

