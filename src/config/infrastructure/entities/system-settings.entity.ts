import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', default: 5000 })
  storageLimit: number;

  @Column({ type: 'text', default: 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,png' })
  allowedFileTypes: string;

  @Column({ type: 'int', default: 14 })
  maxReviewDays: number;

  @Column({ type: 'boolean', default: true })
  auditLogsEnabled: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
