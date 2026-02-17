import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Message } from '../../infrastructure/entities/message.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async create(
    projectId: string,
    content: string,
    user: User,
    threadId?: string,
  ): Promise<Message> {
    const message = this.messageRepo.create({
      projectId,
      content,
      authorId: user.id,
      threadId: threadId || null,
    });

    return this.messageRepo.save(message);
  }

  async findByProject(
    projectId: string,
    limit = 50,
    offset = 0,
  ): Promise<Message[]> {
    return this.messageRepo.find({
      where: { projectId, threadId: IsNull() },
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findThreadReplies(threadId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { threadId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(messageId: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['author'],
    });

    if (!message) {
      throw new NotFoundException(`Mensaje ${messageId} no encontrado`);
    }

    return message;
  }

  async update(
    messageId: string,
    content: string,
    user: User,
  ): Promise<Message> {
    const message = await this.findOne(messageId);

    if (message.authorId !== user.id) {
      throw new ForbiddenException('Solo el autor puede editar este mensaje');
    }

    await this.messageRepo.update(messageId, {
      content,
      isEdited: true,
    });

    return this.findOne(messageId);
  }

  async remove(messageId: string, user: User): Promise<void> {
    const message = await this.findOne(messageId);

    if (message.authorId !== user.id) {
      throw new ForbiddenException('Solo el autor puede eliminar este mensaje');
    }

    await this.messageRepo.delete(messageId);
  }

  async countByProject(projectId: string): Promise<number> {
    return this.messageRepo.count({ where: { projectId } });
  }
}

