import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { VirtualNumber } from '../../numbers/entities/virtual-number.entity';
import { BusinessNumber } from '../../numbers/entities/business-number.entity';
import { CampaignJob } from './campaign-job.entity';

export type SentMessageStatus = 'pending' | 'sent' | 'failed';

@Entity('sent_messages')
export class SentMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'campaign_id', type: 'int' })
  campaignId: number;

  @ManyToOne(() => CampaignJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_job_id' })
  campaignJob: CampaignJob;

  @Column({ name: 'campaign_job_id', type: 'int' })
  campaignJobId: number;

  @ManyToOne(() => Contact, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contact_id' })
  contact?: Contact | null;

  @Column({ name: 'contact_id', type: 'int', nullable: true })
  contactId?: number | null;

  @Column({ name: 'to_phone', type: 'varchar', length: 32 })
  toPhone: string;

  @ManyToOne(() => VirtualNumber, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'virtual_number_id' })
  virtualNumber?: VirtualNumber | null;

  @Column({ name: 'virtual_number_id', type: 'int', nullable: true })
  virtualNumberId?: number | null;

  @ManyToOne(() => BusinessNumber, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'business_number_id' })
  businessNumber?: BusinessNumber | null;

  @Column({ name: 'business_number_id', type: 'int', nullable: true })
  businessNumberId?: number | null;

  @Column({ type: 'text', nullable: true })
  caption?: string | null;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl?: string | null;

  @Column({ name: 'media_type', type: 'varchar', length: 50, nullable: true })
  mediaType?: string | null;

  @Column({ name: 'media_name', type: 'varchar', length: 255, nullable: true })
  mediaName?: string | null;

  @Column({ name: 'cta', type: 'jsonb', nullable: true, default: () => "'[]'::jsonb" })
  cta?: Record<string, any>[] | null;

  @Column({ type: 'varchar', length: 32 })
  status: SentMessageStatus;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @CreateDateColumn({ name: 'queued_at' })
  queuedAt: Date;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @Column({ name: 'last_error_at', type: 'timestamp', nullable: true })
  lastErrorAt?: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
