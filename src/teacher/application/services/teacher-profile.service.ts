import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../../users/infrastructure/entities/user.entity';
import { UpdateTeacherProfileDto } from '../dto/update-teacher-profile.dto';

@Injectable()
export class TeacherProfileService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async getProfile(teacherId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: teacherId },
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name ? String(user.role.name).toLowerCase() : null,
      avatar_url: (user as any).avatarUrl ?? null,
      avatar_color: (user as any).avatarColor ?? null,
    };
  }

  async updateProfile(teacherId: number, dto: UpdateTeacherProfileDto) {
    const update: any = {};

    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (trimmed) update.name = trimmed;
    }
    if (dto.avatar_url !== undefined) {
      const trimmed = dto.avatar_url.trim();
      update.avatarUrl = trimmed || null;
    }
    if (dto.avatar_color !== undefined) {
      const trimmed = dto.avatar_color.trim();
      update.avatarColor = trimmed || null;
    }

    if (Object.keys(update).length > 0) {
      await this.usersRepo.update({ id: teacherId }, update);
    }

    return this.getProfile(teacherId);
  }
}


