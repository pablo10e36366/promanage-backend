import { Injectable } from '@nestjs/common';

import { AdminService } from '../services/admin.service';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class ResolveRoleUpgradeRequestUseCase {
  constructor(private readonly adminService: AdminService) {}

  execute(
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    actor: User,
    notes?: string,
  ) {
    return this.adminService.resolveRoleUpgradeRequest(requestId, decision, actor, notes);
  }
}
