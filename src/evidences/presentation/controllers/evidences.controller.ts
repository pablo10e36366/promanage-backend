import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { EvidencesService } from '../../application/services/evidences.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { CreateEvidenceDto } from '../dto/create-evidence.dto';
import { ReviewEvidenceDto } from '../dto/review-evidence.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';
import {
  CreateFileDto,
  CreateFolderDto,
  UpdateContentDto,
} from '../dto/file-system.dto';
import type { Multer } from 'multer';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller('evidences')
@UseGuards(JwtAuthGuard)
export class EvidencesController {
  constructor(private readonly evidencesService: EvidencesService) {}

  /**
   * @deprecated Usar endpoints especÃ­ficos de file-system
   */
  @Post()
  @Roles('colaborador')
  submit(
    @Body() createEvidenceDto: CreateEvidenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.evidencesService.submit(createEvidenceDto, user);
  }

  // --- FILE SYSTEM API ---

  @Get('search')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  searchMyFiles(@Query('q') query: string, @Req() req: AuthenticatedRequest) {
    return this.evidencesService.searchMyFiles(query, req.user);
  }

  @Post('folders')
  @Roles('colaborador', 'mentor', 'admin', 'docente')
  createFolder(@Body() dto: CreateFolderDto, @Req() req: AuthenticatedRequest) {
    return this.evidencesService.createFolder(dto, req.user);
  }

  @Post('files')
  @Roles('colaborador', 'mentor', 'admin', 'docente')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = join(process.cwd(), 'uploads', 'evidences');
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${unique}${ext}`);
        },
      }),
    }),
  )
  createFile(
    @Body() dto: CreateFileDto,
    @UploadedFile() file: Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Archivo es requerido');
    return this.evidencesService.createFile(dto, file, req.user);
  }

  @Get('projects/:projectId/files')
  getFolderContents(
    @Param('projectId') projectId: string,
    @Query('folderId') folderId: string | null,
  ) {
    return this.evidencesService.getFolderContents(projectId, folderId);
  }

  @Get('projects/:projectId/student-files-by-activity')
  @Roles('professor', 'admin', 'docente')
  getStudentFilesByActivity(@Param('projectId') projectId: string) {
    return this.evidencesService.getStudentFilesByActivity(projectId);
  }

  @Get(':id/download')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const info = await this.evidencesService.getDownloadInfo(id, req.user);

    if (!existsSync(info.filePath)) {
      throw new NotFoundException(
        'El archivo fÃ­sico no se encuentra en el servidor.',
      );
    }

    return new StreamableFile(createReadStream(info.filePath), {
      type: info.mimeType,
      disposition: `attachment; filename="${info.dispositionFilename}"`,
    });
  }

  // --- EDITOR LOCKING ---

  @Post(':id/lock')
  acquireLock(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.evidencesService.acquireLock(id, req.user);
  }

  @Post(':id/unlock')
  releaseLock(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.evidencesService.releaseLock(id, req.user);
  }

  @Put(':id/content')
  saveContent(
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.evidencesService.saveContent(id, dto, req.user);
  }

  // --- LEGACY ENDPOINTS ---

  @Patch(':id/review')
  @Roles('mentor', 'professor', 'admin')
  review(
    @Param('id') id: string,
    @Body() reviewEvidenceDto: ReviewEvidenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.evidencesService.review(id, reviewEvidenceDto, user);
  }

  @Get('milestone/:milestoneId')
  findAllByMilestone(@Param('milestoneId') milestoneId: string) {
    return this.evidencesService.findAllByMilestone(milestoneId);
  }

  @Get(':id')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.evidencesService.findOneForUser(id, req.user);
  }
}

