import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './infrastructure/entities/project.entity';
import { User } from '../users/infrastructure/entities/user.entity';
import { ProjectsService } from './application/services/projects.service';
import { ProjectsController } from './presentation/controllers/projects.controller';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User]), // ðŸ‘ˆ REGISTRAMOS Project y User
    ActivityModule,
  ],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}

