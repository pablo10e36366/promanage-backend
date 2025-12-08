import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  // Crear un proyecto para un usuario (usando su ID)
  async createForUser(
    userId: number,
    title: string,
    description?: string,
  ): Promise<Project> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`No se encontró el usuario con id ${userId}`);
    }

    const project = this.projectsRepo.create({
      title,
      description,
      user,
    });

    return this.projectsRepo.save(project);
  }

  // 🔹 Usado por @Get('all') -> SOLO admin
  async findAll(): Promise<Project[]> {
    return this.projectsRepo.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  // 🔹 Usado por @Get() -> usuario / colaborador / admin (solo los suyos)
  async findByUser(userId: number): Promise<Project[]> {
    return this.projectsRepo.find({
      where: { user: { id: userId } },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  // 🔹 Usado por @Get('resumen') -> admin y colaborador
  async getResumen() {
    const total = await this.projectsRepo.count();
    const activos = await this.projectsRepo.count({
      where: { status: 'activo' },
    });
    const completados = await this.projectsRepo.count({
      where: { status: 'completado' },
    });
    const archivados = await this.projectsRepo.count({
      where: { status: 'archivado' },
    });

    return {
      total,
      activos,
      completados,
      archivados,
    };
  }
}
