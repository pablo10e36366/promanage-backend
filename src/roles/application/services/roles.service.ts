import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../infrastructure/entities/role.entity';
import { RoleType } from '../../domain/permissions';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
  ) {}

  async findByName(name: RoleType) {
    return this.rolesRepo.findOne({ where: { name } });
  }

  findAll() {
    return this.rolesRepo.find();
  }

  async seedRoles() {
    const roles = Object.values(RoleType);
    for (const roleName of roles) {
      const exists = await this.rolesRepo.findOne({
        where: { name: roleName },
      });
      if (!exists) {
        await this.rolesRepo.save({ name: roleName });
      }
    }
  }
}
