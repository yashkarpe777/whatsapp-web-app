import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export interface CampaignCtaButton {
  type: 'URL' | 'PHONE' | 'QUICK_REPLY';
  title: string;
  payload?: string;
  url?: string;
  phoneNumber?: string;
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 150 })
  campaign_name: string;

  @Column({ length: 150, nullable: true })
  name?: string | null;

  @Column({ name: 'template_id', type: 'int', nullable: true })
  templateId?: number | null;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ type: 'text', nullable: true })
  media_url: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  media_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  media_name: string;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl?: string | null;

  @Column({ name: 'cta_buttons', type: 'jsonb', default: () => "'[]'::jsonb" })
  ctaButtons: CampaignCtaButton[];

  @Column({ default: 'draft' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduled_start: Date;

  @Column({ type: 'timestamp', nullable: true })
  scheduled_end: Date;

  @Column({ name: 'recipients_count', type: 'int', default: 0 })
  recipientsCount: number;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount: number;

  @Column({ name: 'read_count', type: 'int', default: 0 })
  readCount: number;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}