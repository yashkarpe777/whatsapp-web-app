import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

export type CampaignJobStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

@Entity('campaign_jobs')
export class CampaignJob {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'campaign_id', type: 'int' })
  campaignId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'virtual_number_id', type: 'int', nullable: true })
  virtualNumberId?: number | null;

  @Column({ name: 'virtual_number_label', type: 'varchar', length: 255, nullable: true })
  virtualNumberLabel?: string | null;

  @Column({ name: 'business_number_id', type: 'int', nullable: true })
  businessNumberId?: number | null;

  @Column({ name: 'business_number', type: 'varchar', length: 255, nullable: true })
  businessNumber?: string | null;

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

  @Column({ name: 'job_id', type: 'varchar', length: 128 })
  jobId: string;

  @Column({ name: 'batch_index', type: 'int' })
  batchIndex: number;

  @Column({ name: 'total_batches', type: 'int' })
  totalBatches: number;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'varchar', length: 32 })
  status: CampaignJobStatus;

  @Column({ type: 'int', default: 0 })
  attempt: number;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @CreateDateColumn({ name: 'queued_at' })
  queuedAt: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt?: Date | null;
}
