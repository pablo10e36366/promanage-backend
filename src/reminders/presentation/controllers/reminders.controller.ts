import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RemindersService } from '../../application/services/reminders.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CreateReminderDto, UpdateReminderDto } from '../../application/dto/reminder.dto';
import { Request } from 'express';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  create(@Req() req: Request & { user: User }, @Body() dto: CreateReminderDto) {
    return this.remindersService.create(req.user, dto);
  }

  @Get()
  findAll(@Req() req: Request & { user: User }) {
    return this.remindersService.findAllByUser(req.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
  ) {
    return this.remindersService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
    @Body() dto: UpdateReminderDto,
  ) {
    return this.remindersService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: User },
  ) {
    return this.remindersService.remove(id, req.user.id);
  }
}

