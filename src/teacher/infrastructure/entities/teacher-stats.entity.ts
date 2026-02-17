import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('teacher_stats')
export class TeacherStats {
  @PrimaryColumn({ type: 'int' })
  teacherId: number;

  @Column({ type: 'int', default: 0 })
  pendingSubmissionsCount: number;

  @Column({ type: 'int', default: 0 })
  unansweredThreadsCount: number;

  @Column({ type: 'int', default: 0 })
  overdueCount: number;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
