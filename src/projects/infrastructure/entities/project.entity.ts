import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { Milestone } from '../../../milestones/infrastructure/entities/milestone.entity';
import { Review } from '../../../reviews/infrastructure/entities/review.entity';
import { ProjectStatus } from '../../domain/project-status';

// Re-exportar para compatibilidad
export { ProjectStatus };

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  // LMS-style course code (unique per owner/teacher)
  @Column({ type: 'varchar', nullable: true, length: 10 })
  code: string | null;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  status: ProjectStatus;

  @Column({ nullable: true })
  validatedBy: number; // ID del professor que validÃ³ (cuando status = completed)

  @Column({ nullable: true })
  repositoryUrl: string;

  @Column({ nullable: true })
  filename: string;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date;

  @Column({ nullable: true })
  archivedBy: number; // ID of admin who archived this project

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @ManyToOne(() => User, (user) => user.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => Milestone, (milestone) => milestone.project)
  milestones: Milestone[];

  @OneToMany(() => Review, (review) => review.project)
  reviews: Review[];
}

