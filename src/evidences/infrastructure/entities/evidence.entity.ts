import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Milestone } from '../../../milestones/infrastructure/entities/milestone.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { EvidenceStatus, EvidenceType } from '../../domain/evidence.enums';

// Re-exportar para compatibilidad con imports existentes
export { EvidenceStatus, EvidenceType };

@Entity('evidences')
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  title?: string;

  // Filesystem & Content
  @Column({ type: 'boolean', default: false })
  isFolder: boolean;

  @Column({ type: 'varchar', nullable: true })
  mimeType?: string | null; // e.g. 'application/pdf', 'text/html'

  @Column({ type: 'text', nullable: true })
  contentBlob?: string | null; // For rich text editor (HTML/JSON)

  @Column({ type: 'varchar', nullable: true })
  url?: string | null; // Original URL or S3 Key

  // Hierarchy
  @Column({ type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => Evidence, (evidence) => evidence.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent: Evidence;

  @OneToMany(() => Evidence, (evidence) => evidence.parent)
  children: Evidence[];

  // Collaborative Editing (Locking)
  @Column({ type: 'int', nullable: true })
  lockUserId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lockUserId' })
  lockUser?: User;

  @Column({ type: 'timestamp', nullable: true })
  lockExpiresAt?: Date;

  // Metadata
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  feedback?: string | null;

  @Column({
    type: 'enum',
    enum: EvidenceStatus,
    default: EvidenceStatus.SUBMITTED,
  })
  status: EvidenceStatus;

  @Column({
    type: 'enum',
    enum: EvidenceType,
  })
  type: EvidenceType;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => Milestone, (milestone) => milestone.evidences, {
    onDelete: 'CASCADE',
  })
  milestone: Milestone;

  @ManyToOne(() => User, (user) => user.evidences, {
    onDelete: 'CASCADE',
  })
  author: User;
}


