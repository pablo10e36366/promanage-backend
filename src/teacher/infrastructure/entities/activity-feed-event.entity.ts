import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ActivityFeedEventType =
  | 'submission_created'
  | 'submission_reviewed'
  | 'thread_created'
  | 'reply_created'
  | 'announcement_created';

export type ActivityActorType = 'student' | 'teacher' | 'system';

@Entity('activity_feed_events')
export class ActivityFeedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  teacherId: number;

  @Column({ type: 'uuid' })
  courseId: string;

  @Column({ type: 'varchar', length: 50 })
  type: ActivityFeedEventType;

  @Column({ type: 'varchar', length: 20 })
  actorType: ActivityActorType;

  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  actorName: string | null;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: unknown;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
