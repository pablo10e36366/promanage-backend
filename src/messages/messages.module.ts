import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './infrastructure/entities/message.entity';
import { MessagesService } from './application/services/messages.service';
import { MessagesController } from './presentation/controllers/messages.controller';
import { ChatGateway } from './presentation/gateways/chat.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  controllers: [MessagesController],
  providers: [MessagesService, ChatGateway],
  exports: [MessagesService],
})
export class MessagesModule {}
