import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../users/infrastructure/entities/user.entity';

export enum ActivityAction {
  SUBMIT_EVIDENCE = 'SUBMIT_EVIDENCE',
  REVIEW_EVIDENCE = 'REVIEW_EVIDENCE',
  PROJECT_CREATE = 'PROJECT_CREATE',
  PROJECT_STATUS_CHANGE = 'PROJECT_STATUS_CHANGE',
  PROJECT_UPDATE = 'PROJECT_UPDATE',
  PROJECT_DELETE = 'PROJECT_DELETE',
  PROJECT_ARCHIVE = 'PROJECT_ARCHIVE',
  PROJECT_DEADLINE_CHANGE = 'PROJECT_DEADLINE_CHANGE',
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_VERSION_NEW = 'FILE_VERSION_NEW',
  FILE_RESTORE = 'FILE_RESTORE',
  FILE_DELETE = 'FILE_DELETE',
  COMMENT_ADD = 'COMMENT_ADD',
  REVIEW_REQUEST = 'REVIEW_REQUEST',
  REVIEW_RESOLVE = 'REVIEW_RESOLVE',
  USER_ASSIGN = 'USER_ASSIGN',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  MESSAGE_SENT = 'MESSAGE_SENT',
}

export type Reactions = Record<string, number[]>;

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.activityLogs)
  user: User;

  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  reactions: Reactions;

  @CreateDateColumn()
  createdAt: Date;
}
