import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../roles/roles.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard) // Todas las rutas requieren login
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // 🔹 SUBIR PROYECTO -> POST /projects
  @Post()
  @Roles('usuario', 'colaborador', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // Carpeta donde se guardan los archivos
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${unique}${ext}`);
        },
      }),
    }),
  )
  async uploadProject(
    @Req() req,
    @UploadedFile() file: any,
    @Body('title') title: string,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('El archivo es obligatorio');
    }

    // del token JWT: { sub, email, name, role }
    const userId = req.user.sub as number;

    const project = await this.projectsService.createForUser(
      userId,
      title,
      description,
    );

    return {
      message: 'Proyecto subido correctamente',
      project,
    };
  }

  // 🔹 GET /projects/all -> SOLO ADMIN
  @Get('all')
  @Roles('admin')
  findAll() {
    return this.projectsService.findAll();
  }

  // 🔹 GET /projects/resumen -> admin y colaborador
  @Get('resumen')
  @Roles('admin', 'colaborador')
  getResumen() {
    return this.projectsService.getResumen();
  }

  // 🔹 GET /projects -> proyectos del usuario logueado
  @Get()
  @Roles('usuario', 'colaborador', 'admin')
  findMine(@Req() req) {
    const userId = req.user.sub;
    return this.projectsService.findByUser(userId);
  }
}
