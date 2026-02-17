import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('course_stats')
export class CourseStats {
  @PrimaryColumn({ type: 'uuid' })
  courseId: string;

  @Column({ type: 'int' })
  teacherId: number;

  @Column({ type: 'int', default: 0 })
  studentsCount: number;

  @Column({ type: 'int', default: 0 })
  pendingSubmissionsCount: number;

  @Column({ type: 'int', default: 0 })
  unansweredThreadsCount: number;

  @Column({ type: 'int', default: 0 })
  overdueSubmissionsCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
