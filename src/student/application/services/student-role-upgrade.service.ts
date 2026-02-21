import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RoleUpgradeRequest, RoleUpgradeRequestStatus } from '../../../users/infrastructure/entities/role-upgrade-request.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class StudentRoleUpgradeService {
  constructor(
    @InjectRepository(RoleUpgradeRequest)
    private readonly roleUpgradeRequestRepo: Repository<RoleUpgradeRequest>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async getLatestRequest(studentId: number) {
    const request = await this.roleUpgradeRequestRepo.findOne({
      where: { userId: studentId, requestedRole: 'docente' },
      order: { createdAt: 'DESC' },
    });
    return this.toDto(request);
  }

  async createTeacherRequest(studentId: number, message?: string) {
    const user = await this.usersRepo.findOne({
      where: { id: studentId },
      relations: ['role'],
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const currentRole = String(user.role?.name || '').toLowerCase();
    if (currentRole === 'docente') {
      throw new BadRequestException('Ya tienes rol de docente');
    }
    if (currentRole === 'admin') {
      throw new BadRequestException('Tu rol actual no requiere solicitud');
    }

    const pending = await this.roleUpgradeRequestRepo.findOne({
      where: {
        userId: studentId,
        requestedRole: 'docente',
        status: RoleUpgradeRequestStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
    if (pending) {
      throw new ConflictException('Ya tienes una solicitud pendiente');
    }

    const request = this.roleUpgradeRequestRepo.create({
      userId: studentId,
      requestedRole: 'docente',
      message: message?.trim() || null,
      status: RoleUpgradeRequestStatus.PENDING,
      adminNote: null,
      reviewedByUserId: null,
      reviewedAt: null,
    });
    const saved = await this.roleUpgradeRequestRepo.save(request);
    return this.toDto(saved);
  }

  private toDto(request: RoleUpgradeRequest | null) {
    if (!request) return null;
    return {
      id: request.id,
      status: request.status,
      requested_role: request.requestedRole,
      message: request.message ?? null,
      admin_note: request.adminNote ?? null,
      created_at: request.createdAt?.toISOString?.() ?? null,
      reviewed_at: request.reviewedAt?.toISOString?.() ?? null,
    };
  }
}
