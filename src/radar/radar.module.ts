import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RadarController } from './presentation/controllers/radar.controller';
import { RadarService } from './application/services/radar.service';
import { Project } from '../projects/infrastructure/entities/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [RadarController],
  providers: [RadarService],
  exports: [RadarService],
})
export class RadarModule {}
