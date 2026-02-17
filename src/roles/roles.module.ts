import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './infrastructure/entities/role.entity';
import { User } from '../users/infrastructure/entities/user.entity';
import { RolesService } from './application/services/roles.service';
import { RolesController } from './presentation/controllers/roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User])],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule { }
