import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SubmissionReviewStatus = 'approved' | 'changes_requested';

@Entity('submission_reviews')
export class SubmissionReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  submissionId: string;

  @Column({ type: 'int' })
  teacherId: number;

  @Column({ type: 'varchar', length: 50 })
  status: SubmissionReviewStatus;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rubricScores: unknown;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
