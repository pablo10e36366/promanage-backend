import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AssignmentsService } from '../../application/services/assignments.service';
import { CreateAssignmentDto } from '../../application/dto/create-assignment.dto';
import { ReviewAssignmentDto } from '../../application/dto/review-assignment.dto';
import { Assignment } from '../../infrastructure/entities/assignment.entity';
import { AssignmentStatus } from '../../domain/assignment-status';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../roles/presentation/guards/roles.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * POST /assignments
   * Crea una nueva entrega (assignment)
   * Permisos: estudiante (o cualquier usuario autenticado)
   */
  @Post()
  @Roles('colaborador', 'professor', 'admin', 'docente')
  async create(
    @Body() createDto: CreateAssignmentDto,
    @Request() req,
  ): Promise<Assignment> {
    const user = req.user as User;
    return this.assignmentsService.create(createDto, user);
  }

  /**
   * GET /assignments/project/:projectId
   * Lista todas las entregas de un proyecto específico
   * Permisos: profesor o admin (owner del proyecto)
   */
  @Get('project/:projectId')
  @Roles('professor', 'admin', 'docente')
  async findByProject(
    @Param('projectId') projectId: string,
    @Request() req,
  ): Promise<Assignment[]> {
    const user = req.user as User;
    return this.assignmentsService.findByProject(projectId, user);
  }

  /**
   * PATCH /assignments/:id/review
   * Marca una entrega como REVISADA y agrega feedback
   * Permisos: profesor o admin
   */
  @Patch(':id/review')
  @HttpCode(HttpStatus.OK)
  @Roles('professor', 'admin', 'docente')
  async review(
    @Param('id') id: string,
    @Body() reviewDto: ReviewAssignmentDto,
    @Request() req,
  ): Promise<Assignment> {
    const user = req.user as User;
    return this.assignmentsService.review(id, reviewDto, user);
  }

  /**
   * GET /assignments/:id
   * Obtiene una entrega por ID (endpoint adicional útil)
   * Permisos: profesor, admin o estudiante dueño de la entrega
   */
  @Get(':id')
  @Roles('colaborador', 'professor', 'admin', 'docente')
  async findOne(@Param('id') id: string, @Request() req): Promise<Assignment> {
    const user = req.user as User;
    return this.assignmentsService.findOne(id, user);
  }

  /**
   * PATCH /assignments/:id/status
   * Cambia el estado de una entrega (por ejemplo, de PENDIENTE a ENTREGADO)
   * Permisos: según el estado (estudiante puede marcar como ENTREGADO, profesor puede revisar)
   */
  @Patch(':id/status')
  @Roles('colaborador', 'professor', 'admin', 'docente')
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: AssignmentStatus,
    @Request() req,
  ): Promise<Assignment> {
    const user = req.user as User;
    return this.assignmentsService.changeStatus(id, status, user);
  }

  /**
   * DELETE /assignments/:id
   * Elimina una entrega (solo profesor o admin)
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @Roles('professor', 'admin', 'docente')
  async remove(@Param('id') id: string, @Request() req): Promise<void> {
    const user = req.user as User;
    return this.assignmentsService.remove(id, user);
  }
}


