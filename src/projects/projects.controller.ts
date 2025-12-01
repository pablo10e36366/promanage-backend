import {
  Controller,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../roles/roles.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard) // primero JWT
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // SOLO admin puede ver todos los proyectos
  @Get('all')
  @Roles('admin')
  findAll() {
    return this.projectsService.findAll();
  }

  // admin y colaborador pueden ver un resumen
  @Get('resumen')
  @Roles('admin', 'colaborador')
  getResumen() {
    return this.projectsService.getResumen();
  }

  // usuario / colaborador / admin ven SUS proyectos
  @Get()
  @Roles('usuario', 'colaborador', 'admin')
  findMine(@Req() req) {
    const userId = req.user.sub;
    return this.projectsService.findByUser(userId);
  }
}
