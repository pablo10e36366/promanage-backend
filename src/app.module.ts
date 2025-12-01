import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { User } from './users/user.entity';
import { Role } from './roles/roles.entity';
import { Project } from './projects/project.entity';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ProjectsModule } from './projects/projects.module';

import { RolesGuard } from './roles/roles.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '123456',
      database: 'promanage',
      entities: [User, Role, Project],
      synchronize: false,
    }),

    AuthModule,
    UsersModule,
    RolesModule,
    ProjectsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // 🔐 1. Guard global JWT (Obligatorio)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // 🛡️ 2. Guard global Roles (Depende del JWT)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
