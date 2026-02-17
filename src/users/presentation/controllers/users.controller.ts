import { Controller, Get, Req } from '@nestjs/common';
import express from 'express';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  @Get()
  @Roles('admin')
  findAll() {
    return { message: 'Solo el ADMIN puede ver esta ruta' };
  }

  @Get('me')
  @Roles('admin', 'user', 'colaborador', 'mentor', 'professor')
  getProfile(@Req() req: express.Request) {
    return {
      message: 'Perfil del usuario logueado',
      user: req.user,
    };
  }
}
