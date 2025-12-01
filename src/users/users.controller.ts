import { Controller, Get, Req } from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import express from 'express';

@Controller('users')
export class UsersController {
  @Get()
  @Roles('admin')
  findAll() {
    return { message: 'Solo el ADMIN puede ver esta ruta' };
  }

  @Get('me')
  @Roles('admin', 'usuario')
  getProfile(@Req() req: express.Request) {
    return {
      message: 'Perfil del usuario logueado',
      user: req.user,
    };
  }
}
