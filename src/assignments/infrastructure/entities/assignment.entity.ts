import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { Milestone } from '../../../milestones/infrastructure/entities/milestone.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';
import { AssignmentStatus } from '../../domain/assignment-status';

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid', nullable: true })
  milestoneId: string | null;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ type: 'uuid', nullable: true })
  evidenceId: string | null;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.PENDIENTE,
  })
  status: AssignmentStatus;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date | null;

  @Column({ type: 'boolean', default: false })
  isLate: boolean;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  // Teacher review outcome (normalized for LMS UX): APPROVED | CHANGES_REQUESTED
  @Column({ type: 'varchar', length: 50, nullable: true })
  reviewOutcome: string | null;

  @Column({ type: 'int', nullable: true })
  reviewedById: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Project, (project) => project.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @ManyToOne(() => Milestone, (milestone) => milestone.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'milestoneId' })
  milestone: Milestone | null;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;

  @ManyToOne(() => Evidence, (evidence) => evidence.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'evidenceId' })
  evidence: Evidence | null;
}

