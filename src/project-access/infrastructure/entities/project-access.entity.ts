import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

export enum ProjectPermission {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
}

export enum AccessStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
}

@Entity('project_access')
@Unique(['project', 'user']) // Un usuario solo puede tener un permiso activo por proyecto
export class ProjectAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: ProjectPermission,
  })
  permission: ProjectPermission;

  @Column({
    type: 'enum',
    enum: AccessStatus,
    default: AccessStatus.PENDING,
  })
  status: AccessStatus;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'granted_by' })
  grantedBy?: User;

  @Column({
    name: 'requested_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  requestedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}


