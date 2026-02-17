import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../infrastructure/entities/user.entity';
import { RolesService } from '../../../roles/application/services/roles.service';
import { RoleType } from '../../../roles/domain/permissions';
import { AuthCredentialsDto } from '../../../auth/application/dto/auth-credentials.dto';

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
    const roleMap: Record<string, RoleType> = {
      admin: RoleType.ADMIN,
      colaborador: RoleType.STUDENT,
      usuario: RoleType.USER,
      mentor: RoleType.MENTOR,
      professor: RoleType.PROFESSOR,
      docente: RoleType.DOCENTE,
    };

    const roleName = roleMap[data.role || 'usuario'] || RoleType.USER;
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

  async validateUser(authCredentialsDto: AuthCredentialsDto): Promise<User | null> {
    const { email, password } = authCredentialsDto;
    const user = await this.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }
}

