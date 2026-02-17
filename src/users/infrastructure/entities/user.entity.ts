import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../../roles/infrastructure/entities/role.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';
import { ActivityLog } from '../../../activity/infrastructure/entities/activity-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true, length: 7 })
  avatarColor: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  blockedAt: Date;

  @Column({ nullable: true })
  blockedBy: number;

  @ManyToOne(() => Role, (role) => role.users, { nullable: true, eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => Project, (project) => project.owner)
  projects: Project[];

  @OneToMany(() => Evidence, (evidence) => evidence.author)
  evidences: Evidence[];

  @OneToMany(() => ActivityLog, (log) => log.user)
  activityLogs: ActivityLog[];
}
