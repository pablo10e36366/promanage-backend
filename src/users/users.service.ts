import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<User> {
    const roleName = (data.role as 'admin' | 'colaborador' | 'usuario') ?? 'usuario';

    const roleEntity = await this.rolesService.findByName(roleName);
    if (!roleEntity) {
      throw new Error(`No existe el rol "${roleName}" en la base de datos`);
    }

    const newUser = this.usersRepo.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: roleEntity,
    });

    return this.usersRepo.save(newUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.usersRepo.findOne({
      where: { email },
      relations: ['role'],
    });
    return user ?? null;
  }
}
