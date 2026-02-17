import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MessagesService } from '../../application/services/messages.service';
import { User } from '../../../users/infrastructure/entities/user.entity';

interface ChatUser {
  socketId: string;
  userId: number;
  userName: string;
  projectId: string;
  isOnline: boolean;
  lastSeen: Date;
}

interface ChatMessage {
  id: string;
  content: string;
  authorId: number;
  authorName: string;
  projectId: string;
  createdAt: Date;
  isEdited: boolean;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private projectUsers = new Map<string, Map<string, ChatUser>>();
  private socketToUser = new Map<string, { userId: number; projectId: string }>();

  constructor(private readonly messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to chat: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from chat: ${client.id}`);
    this.removeUserFromAllProjects(client.id);
  }

  private removeUserFromAllProjects(socketId: string) {
    const userInfo = this.socketToUser.get(socketId);
    if (!userInfo) return;

    const { projectId } = userInfo;
    const projectUsers = this.projectUsers.get(projectId);
    if (projectUsers) {
      projectUsers.delete(socketId);
      this.broadcastPresence(projectId);
    }

    this.socketToUser.delete(socketId);
  }

  @SubscribeMessage('join-chat')
  async handleJoinChat(
    @MessageBody()
    data: { projectId: string; userId: number; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, userId, userName } = data;

    await client.join(`project:${projectId}`);
    this.logger.log(`Client ${client.id} (${userName}) joined chat for project ${projectId}`);

    if (!this.projectUsers.has(projectId)) {
      this.projectUsers.set(projectId, new Map());
    }

    const chatUser: ChatUser = {
      socketId: client.id,
      userId,
      userName,
      projectId,
      isOnline: true,
      lastSeen: new Date(),
    };

    this.projectUsers.get(projectId)!.set(client.id, chatUser);
    this.socketToUser.set(client.id, { userId, projectId });

    const messages = await this.messagesService.findByProject(projectId, 50, 0);
    const formattedMessages: ChatMessage[] = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      authorId: msg.authorId,
      authorName: msg.author?.name || 'Desconocido',
      projectId: msg.projectId,
      createdAt: msg.createdAt,
      isEdited: msg.isEdited,
    }));

    client.emit('chat-history', {
      projectId,
      messages: formattedMessages,
    });

    this.broadcastPresence(projectId);
  }

  @SubscribeMessage('leave-chat')
  async handleLeaveChat(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId } = data;
    await client.leave(`project:${projectId}`);

    this.projectUsers.get(projectId)?.delete(client.id);
    this.socketToUser.delete(client.id);
    this.broadcastPresence(projectId);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() data: { projectId: string; content: string; userId: number; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, content, userId, userName } = data;

    if (!content.trim()) {
      client.emit('error', { message: 'El mensaje no puede estar vacÃ­o' });
      return;
    }

    try {
      const user = { id: userId } as User;
      const message = await this.messagesService.create(projectId, content, user);

      const chatMessage: ChatMessage = {
        id: message.id,
        content: message.content,
        authorId: message.authorId,
        authorName: userName,
        projectId: message.projectId,
        createdAt: message.createdAt,
        isEdited: message.isEdited,
      };

      this.server.to(`project:${projectId}`).emit('new-message', {
        projectId,
        message: chatMessage,
        senderId: client.id,
      });

      this.logger.log(`Message sent to project ${projectId} by ${userName}`);
    } catch (error) {
      this.logger.error('Error sending message:', error);
      client.emit('error', { message: 'Error al enviar el mensaje' });
    }
  }

  @SubscribeMessage('edit-message')
  async handleEditMessage(
    @MessageBody() data: { projectId: string; messageId: string; content: string; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, messageId, content, userId } = data;

    try {
      const user = { id: userId } as User;
      const updatedMessage = await this.messagesService.update(messageId, content, user);

      const chatMessage: ChatMessage = {
        id: updatedMessage.id,
        content: updatedMessage.content,
        authorId: updatedMessage.authorId,
        authorName: updatedMessage.author?.name || 'Desconocido',
        projectId: updatedMessage.projectId,
        createdAt: updatedMessage.createdAt,
        isEdited: updatedMessage.isEdited,
      };

      this.server.to(`project:${projectId}`).emit('message-edited', {
        projectId,
        message: chatMessage,
      });
    } catch (error) {
      this.logger.error('Error editing message:', error);
      client.emit('error', { message: 'Error al editar el mensaje' });
    }
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(
    @MessageBody() data: { projectId: string; messageId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, messageId, userId } = data;

    try {
      const user = { id: userId } as User;
      await this.messagesService.remove(messageId, user);

      this.server.to(`project:${projectId}`).emit('message-deleted', {
        projectId,
        messageId,
      });
    } catch (error) {
      this.logger.error('Error deleting message:', error);
      client.emit('error', { message: 'Error al eliminar el mensaje' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { projectId: string; userId: number; userName: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, userId, userName, isTyping } = data;

    client.to(`project:${projectId}`).emit('user-typing', {
      projectId,
      userId,
      userName,
      isTyping,
    });
  }

  private broadcastPresence(projectId: string) {
    const users = this.projectUsers.get(projectId);
    const onlineUsers = users ? Array.from(users.values()).filter((u) => u.isOnline) : [];

    this.server.to(`project:${projectId}`).emit('presence-update', {
      projectId,
      onlineUsers: onlineUsers.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        lastSeen: u.lastSeen,
      })),
      onlineCount: onlineUsers.length,
    });
  }

  @SubscribeMessage('get-online-users')
  handleGetOnlineUsers(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId } = data;
    const users = this.projectUsers.get(projectId);
    const onlineUsers = users ? Array.from(users.values()).filter((u) => u.isOnline) : [];

    client.emit('online-users', {
      projectId,
      users: onlineUsers.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        lastSeen: u.lastSeen,
      })),
      count: onlineUsers.length,
    });
  }
}

