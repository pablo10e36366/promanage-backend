import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Entity('versions')
export class Version {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', nullable: true })
  title?: string;

  @Column({ type: 'varchar', nullable: true })
  changeDescription?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'uuid' })
  evidenceId: string;

  @ManyToOne(() => Evidence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evidenceId' })
  evidence: Evidence;

  @Column({ type: 'int' })
  authorId: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User;
}
