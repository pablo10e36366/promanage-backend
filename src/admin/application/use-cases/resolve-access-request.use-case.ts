import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class ResolveAccessRequestUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    actor: User,
    notes?: string,
  ) {
    return this.adminService.resolveAccessRequest(requestId, decision, actor, notes);
  }
}

