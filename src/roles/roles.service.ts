import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './roles.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
  ) {}

  async findByName(name: 'admin' | 'colaborador' | 'usuario') {
    return this.rolesRepo.findOne({ where: { name } });
  }

  findAll() {
    return this.rolesRepo.find();
  }
}
