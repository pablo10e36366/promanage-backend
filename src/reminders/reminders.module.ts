import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemindersController } from './presentation/controllers/reminders.controller';
import { RemindersService } from './application/services/reminders.service';
import { Reminder } from './infrastructure/entities/reminder.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reminder])],
  controllers: [RemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
