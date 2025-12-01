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
  ) {}

  // Crear un proyecto (por si lo usas desde un controller de creación)
  async createForUser(
    user: User,
    title: string,
    description?: string,
  ): Promise<Project> {
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
    const activos = await this.projectsRepo.count({ where: { status: 'activo' } });
    const completados = await this.projectsRepo.count({ where: { status: 'completado' } });
    const archivados = await this.projectsRepo.count({ where: { status: 'archivado' } });

    return {
      total,
      activos,
      completados,
      archivados,
    };
  }
}
