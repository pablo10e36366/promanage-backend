import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAccessController } from './presentation/controllers/project-access.controller';
import { ProjectAccessService } from './application/services/project-access.service';
import { ProjectAccess } from './infrastructure/entities/project-access.entity';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { User } from '../users/infrastructure/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ProjectAccess, Project, User])],
    controllers: [ProjectAccessController],
    providers: [ProjectAccessService],
    exports: [ProjectAccessService],
})
export class ProjectAccessModule { }

