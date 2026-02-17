import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { MessagesService } from '../../application/services/messages.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../roles/presentation/guards/roles.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Controller('projects/:projectId/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.messagesService.findByProject(projectId, limit || 50, offset || 0);
  }

  @Post()
  @Roles('colaborador', 'mentor', 'professor', 'admin')
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request & { user: User },
    @Body('content') content: string,
    @Body('threadId') threadId?: string,
  ) {
    return this.messagesService.create(projectId, content, req.user, threadId);
  }

  @Get('threads/:threadId')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async getThreadReplies(@Param('threadId', ParseUUIDPipe) threadId: string) {
    return this.messagesService.findThreadReplies(threadId);
  }

  @Get(':messageId')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async findOne(@Param('messageId', ParseUUIDPipe) messageId: string) {
    return this.messagesService.findOne(messageId);
  }

  @Put(':messageId')
  @Roles('colaborador', 'mentor', 'professor', 'admin')
  async update(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() req: Request & { user: User },
    @Body('content') content: string,
  ) {
    return this.messagesService.update(messageId, content, req.user);
  }

  @Delete(':messageId')
  @Roles('colaborador', 'mentor', 'professor', 'admin')
  async remove(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() req: Request & { user: User },
  ) {
    const roleName = (req.user as any).role?.name
      ? String((req.user as any).role.name).toLowerCase()
      : String((req.user as any).role || '').toLowerCase();

    if (roleName === 'admin') {
      const message = await this.messagesService.findOne(messageId);
      await this.messagesService.remove(messageId, {
        ...req.user,
        id: message.authorId,
      } as User);
    } else {
      await this.messagesService.remove(messageId, req.user);
    }
    return { message: 'Mensaje eliminado' };
  }

  @Get('count')
  @Roles('user', 'colaborador', 'mentor', 'professor', 'admin', 'docente')
  async count(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const count = await this.messagesService.countByProject(projectId);
    return { count };
  }
}

