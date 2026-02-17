import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityService } from './application/services/activity.service';
import { ActivityLog } from './infrastructure/entities/activity-log.entity';
import {
  ActivityController,
  ActivitiesController,
} from './presentation/controllers/activity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  controllers: [ActivityController, ActivitiesController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
