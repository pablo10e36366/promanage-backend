import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CollaborativeService } from '../../application/services/collaborative.service';

interface UserPresence {
  odId: string;
  oderId: number;
  userName: string;
  color: string;
  cursorPosition?: { line: number; column: number };
  lastSeen: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'collaborative',
})
export class CollaborativeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborativeGateway.name);
  private documentPresence = new Map<string, Map<string, UserPresence>>();

  constructor(private readonly collaborativeService: CollaborativeService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.removeUserFromAllDocuments(client.id);
  }

  private removeUserFromAllDocuments(socketId: string) {
    for (const [docId, users] of this.documentPresence) {
      if (users.has(socketId)) {
        users.delete(socketId);
        this.server.to(`doc:${docId}`).emit('presence-update', {
          documentId: docId,
          users: Array.from(users.values()),
        });
      }
    }
  }

  @SubscribeMessage('join-document')
  async handleJoinDocument(
    @MessageBody()
    data: { documentId: string; userId: number; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { documentId, userId, userName } = data;

    const isLocked =
      await this.collaborativeService.isDocumentLocked(documentId);
    if (isLocked) {
      client.emit('document-locked', {
        documentId,
        message: 'El documento está bloqueado porque el deadline ha pasado',
      });
    }

    await client.join(`doc:${documentId}`);
    this.logger.log(
      `Client ${client.id} (${userName}) joined document ${documentId}`,
    );

    if (!this.documentPresence.has(documentId)) {
      this.documentPresence.set(documentId, new Map());
    }

    const userPresence: UserPresence = {
      odId: client.id,
      oderId: userId,
      userName,
      color: this.generateUserColor(userId),
      lastSeen: new Date(),
    };
    this.documentPresence.get(documentId)!.set(client.id, userPresence);

    const content =
      await this.collaborativeService.getDocumentContent(documentId);
    client.emit('document-content', { content, isLocked });

    this.broadcastPresence(documentId);
  }

  @SubscribeMessage('leave-document')
  async handleLeaveDocument(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { documentId } = data;
    await client.leave(`doc:${documentId}`);

    this.documentPresence.get(documentId)?.delete(client.id);
    this.broadcastPresence(documentId);
  }

  @SubscribeMessage('send-changes')
  async handleSendChanges(
    @MessageBody() data: { documentId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { documentId, content } = data;

    const isLocked =
      await this.collaborativeService.isDocumentLocked(documentId);
    if (isLocked) {
      client.emit('document-locked', {
        documentId,
        message: 'No se pueden guardar cambios: el deadline ha pasado',
      });
      return;
    }

    await this.collaborativeService.updateDocumentContent(documentId, content);

    client.to(`doc:${documentId}`).emit('receive-changes', {
      content,
      senderId: client.id,
    });
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @MessageBody()
    data: { documentId: string; position: { line: number; column: number } },
    @ConnectedSocket() client: Socket,
  ) {
    const { documentId, position } = data;

    const users = this.documentPresence.get(documentId);
    if (users?.has(client.id)) {
      const user = users.get(client.id)!;
      user.cursorPosition = position;
      user.lastSeen = new Date();
    }

    client.to(`doc:${documentId}`).emit('cursor-update', {
      socketId: client.id,
      position,
    });
  }

  private broadcastPresence(documentId: string) {
    const users = this.documentPresence.get(documentId);
    this.server.to(`doc:${documentId}`).emit('presence-update', {
      documentId,
      users: users ? Array.from(users.values()) : [],
    });
  }

  private generateUserColor(userId: number): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
      '#F7DC6F',
    ];
    return colors[userId % colors.length];
  }
}
