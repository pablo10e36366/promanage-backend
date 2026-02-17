import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from '../../infrastructure/entities/reminder.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { CreateReminderDto, UpdateReminderDto } from '../dto/reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepo: Repository<Reminder>,
  ) {}

  async create(user: User, dto: CreateReminderDto): Promise<Reminder> {
    const reminder = this.reminderRepo.create({
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      user,
    });
    return this.reminderRepo.save(reminder);
  }

  async findAllByUser(userId: number): Promise<Reminder[]> {
    return this.reminderRepo.find({
      where: { user: { id: userId } },
      order: { dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: number): Promise<Reminder> {
    const reminder = await this.reminderRepo.findOne({
      where: { id, user: { id: userId } },
    });
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    return reminder;
  }

  async update(
    id: string,
    userId: number,
    dto: UpdateReminderDto,
  ): Promise<Reminder> {
    const reminder = await this.findOne(id, userId);

    if (dto.title !== undefined) reminder.title = dto.title;
    if (dto.description !== undefined) reminder.description = dto.description;
    if (dto.dueDate !== undefined) reminder.dueDate = new Date(dto.dueDate);
    if (dto.isCompleted !== undefined) reminder.isCompleted = dto.isCompleted;

    return this.reminderRepo.save(reminder);
  }

  async remove(id: string, userId: number): Promise<void> {
    const reminder = await this.findOne(id, userId);
    await this.reminderRepo.remove(reminder);
  }
}

