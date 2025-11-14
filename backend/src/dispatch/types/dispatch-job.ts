export type DispatchJobStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CampaignDispatchBatch {
  id: string;
  campaignId: number;
  userId: number;
  batchIndex: number;
  totalBatches: number;
  size: number;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  status: DispatchJobStatus;
  attempt: number;
  error?: string;
}

export interface DispatchMessagePayload {
  caption?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_name?: string | null;
  cta?: Record<string, any>[] | null;
}

export interface DispatchSenderContext {
  virtualNumberId: number;
  virtualNumberLabel?: string;
  businessNumberId?: number;
  businessNumber?: string;
  switchedAt?: Date;
  switchReason?: string;
}

export interface EnqueueCampaignOptions {
  campaignId: number;
  userId: number;
  recipientsCount: number;
  preferredNumberId?: number;
  enqueueReason: 'manual_run' | 'auto_retry' | 'scheduled';
  batchSize?: number;
  assignedNumberId: number;
  assignedNumberLabel?: string;
  businessNumberId?: number;
  businessNumber?: string;
  simulateBan?: boolean;
  messagePayload?: DispatchMessagePayload;
}

export interface EnqueueCampaignResult {
  jobIds: string[];
  totalBatches: number;
  batchSize: number;
  estimatedDurationSeconds: number;
  batches: CampaignDispatchBatch[];
  sender: DispatchSenderContext;
}
