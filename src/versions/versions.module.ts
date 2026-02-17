import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Version } from './infrastructure/entities/version.entity';
import { Evidence } from '../evidences/infrastructure/entities/evidence.entity';
import { VersionsService } from './application/services/versions.service';
import { VersionsController } from './presentation/controllers/versions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Version, Evidence])],
  controllers: [VersionsController],
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}
