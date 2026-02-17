import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  UseGuards,
  Req,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Param,
  Query,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { Request } from 'express';
import type { Multer } from 'multer';
import { ProjectsService } from '../../application/services/projects.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../roles/presentation/guards/roles.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ShareProjectDto } from '../dto/share-project.dto';
import { ForceStatusDto, ArchiveProjectDto } from '../../../admin/application/dto/admin-project.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { ProjectStatus } from '../../domain/project-status';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('search')
  @UseGuards(RolesGuard)
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  search(@Req() req: Request & { user: User }, @Query('q') query: string) {
    return this.projectsService.search(query, req.user);
  }

  @Post(':id')
  @Roles('user', 'colaborador', 'admin', 'docente')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${unique}${ext}`);
        },
      }),
    }),
  )
  async create(
    @Param('id') id: string, // SIN ParseUUIDPipe para evitar validación temprana
    @Req() req: Request & { user: User },
    @UploadedFile() file: Multer.File,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    if (!createProjectDto.title) {
      throw new BadRequestException('El título del proyecto es obligatorio');
    }

    console.log('[DEBUG] Creating project. User:', req.user?.id);
    console.log('[DEBUG] File:', file?.filename);
    console.log('[DEBUG] Body:', JSON.stringify(createProjectDto));

    try {
      return await this.projectsService.create(
        createProjectDto,
        req.user,
        id,
        file?.filename,
      );
    } catch (error) {
      console.error('[CRITICAL] Error in ProjectsController.create:', error);
      throw error;
    }
  }

  @Get('all')
  @Roles('admin', 'docente')
  findAll() {
    return this.projectsService.findAll();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'docente')
  findMine(@Req() req: Request & { user: User }) {
    return this.projectsService.findAllByUser(req.user);
  }

  @Get(':id/repository')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  getRepositoryView(
    @Param('id') id: string,
    @Req() req: Request & { user: User },
  ) {
    return this.projectsService.getRepositoryView(id, req.user);
  }

  @Get(':id/download')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async download(@Param('id', ParseUUIDPipe) id: string) {
    const { filePath } = await this.projectsService.getDownloadInfo(id);

    if (!existsSync(filePath)) {
      throw new NotFoundException(
        'El archivo físico no se encuentra en el servidor.',
      );
    }

    return new StreamableFile(createReadStream(filePath));
  }

  /**
   * Share or schedule a project via drag & drop
   */
  @Post(':id/share')
  @Roles('colaborador', 'admin')
  async shareProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
    @Body() shareDto: ShareProjectDto,
  ) {
    return this.projectsService.shareProject(id, req.user, shareDto);
  }

  @Get(':id')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    console.log('🔎 Buscando proyecto con ID:', id);
    const project = await this.projectsService.findOne(id);
    console.log('✅ Proyecto encontrado:', project ? 'SÍ' : 'NO');
    return project;
  }

  @Put(':id')
  @Roles('colaborador', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
    @Req() req: Request & { user: User },
  ) {
    return this.projectsService.update(id, body, req.user);
  }

  @Delete(':id')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
  ) {
    return this.projectsService.remove(id, req.user);
  }

  /**
   * Cambia el estado de un proyecto (solo professor o admin)
   * Valida transiciones: draft → in_progress → in_review → completed
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('professor', 'admin')
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
    @Body('status') status: ProjectStatus,
  ) {
    if (!status || !Object.values(ProjectStatus).includes(status)) {
      throw new BadRequestException(
        `Estado inválido. Valores permitidos: ${Object.values(ProjectStatus).join(', ')}`,
      );
    }
    return this.projectsService.changeStatus(id, status, req.user);
  }

  /**
   * Obtiene las transiciones de estado disponibles para un proyecto
   */
  @Get(':id/transitions')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async getAvailableTransitions(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getAvailableTransitions(id);
  }

  @Get(':id/activity')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async getActivity(@Param('id') id: string) {
    return this.projectsService.getActivity(id);
  }

  // ===== ADMIN PROJECT CONTROLS =====

  /**
   * Force status change (admin only, bypasses validation)
   */
  @Patch('admin/:id/force-status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async forceStatusChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
    @Body() dto: ForceStatusDto,
  ) {
    return this.projectsService.forceStatusChange(id, dto.status, dto.reason, req.user);
  }

  /**
   * Archive project (admin only)
   */
  @Patch('admin/:id/archive')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async archiveProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
    @Body() dto: ArchiveProjectDto,
  ) {
    return this.projectsService.archiveProject(id, dto.reason, req.user);
  }
}


