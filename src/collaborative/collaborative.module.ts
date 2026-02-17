import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CollaborativeGateway } from './presentation/gateways/collaborative.gateway';
import { CollaborativeService } from './application/services/collaborative.service';
import { Evidence } from '../evidences/infrastructure/entities/evidence.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Evidence]), ScheduleModule.forRoot()],
  providers: [CollaborativeGateway, CollaborativeService],
  exports: [CollaborativeService],
})
export class CollaborativeModule {}
