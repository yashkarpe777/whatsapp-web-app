import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CampaignDispatchBatch,
  DispatchJobStatus,
  EnqueueCampaignOptions,
  EnqueueCampaignResult,
  DispatchSenderContext,
} from './types/dispatch-job';
import { NumbersService } from '../numbers/numbers.service';

const DEFAULT_BATCH_SIZE = 1000;
const PROCESSING_SIMULATION_DELAY_MS = 1500;

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly batches = new Map<string, CampaignDispatchBatch>();
  private readonly campaignSender = new Map<number, DispatchSenderContext>();

  constructor(private readonly numbersService: NumbersService) {}

  enqueueCampaign(options: EnqueueCampaignOptions): EnqueueCampaignResult {
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const totalBatches = Math.max(1, Math.ceil(options.recipientsCount / batchSize));
    const createdAt = new Date();

    const jobIds: string[] = [];

    const initialSender: DispatchSenderContext = {
      virtualNumberId: options.assignedNumberId,
      virtualNumberLabel: options.assignedNumberLabel,
      businessNumberId: options.businessNumberId,
      businessNumber: options.businessNumber,
    };

    this.campaignSender.set(options.campaignId, initialSender);

    for (let index = 0; index < totalBatches; index++) {
      const jobId = this.generateJobId(options.campaignId);
      jobIds.push(jobId);

      const batch: CampaignDispatchBatch = {
        id: jobId,
        campaignId: options.campaignId,
        userId: options.userId,
        batchIndex: index,
        totalBatches,
        size: this.resolveBatchSize(index, totalBatches, options.recipientsCount, batchSize),
        createdAt,
        status: 'queued',
        attempt: 0,
      };

      this.batches.set(jobId, batch);
      const enrichedOptions: EnqueueCampaignOptions = {
        ...options,
        enqueueReason: options.enqueueReason,
        simulateBan:
          options.simulateBan !== undefined
            ? options.simulateBan
            : options.recipientsCount > DEFAULT_BATCH_SIZE * 2,
      };
      this.simulateProcessing(batch, enrichedOptions);
    }

    const estimatedDurationSeconds = totalBatches * PROCESSING_SIMULATION_DELAY_MS * 0.001;

    this.logger.log(
      `Enqueued ${totalBatches} batch(es) for campaign ${options.campaignId} (user ${options.userId}) via ${options.enqueueReason}`,
    );

    return {
      jobIds,
      totalBatches,
      batchSize,
      estimatedDurationSeconds,
      batches: jobIds.map((id) => this.batches.get(id)!).filter(Boolean),
      sender: { ...this.campaignSender.get(options.campaignId)! },
    };
  }

  getBatch(jobId: string): CampaignDispatchBatch | undefined {
    return this.batches.get(jobId);
  }

  listCampaignBatches(campaignId: number): CampaignDispatchBatch[] {
    return Array.from(this.batches.values()).filter((batch) => batch.campaignId === campaignId);
  }

  private generateJobId(campaignId: number): string {
    return `cmp-${campaignId}-${randomUUID()}`;
  }

  private resolveBatchSize(
    index: number,
    totalBatches: number,
    recipientsCount: number,
    batchSize: number,
  ): number {
    if (index === totalBatches - 1) {
      const consumed = batchSize * index;
      return Math.max(0, recipientsCount - consumed) || batchSize;
    }

    return batchSize;
  }

  private simulateProcessing(batch: CampaignDispatchBatch, options: EnqueueCampaignOptions) {
    setTimeout(async () => {
      const existing = this.batches.get(batch.id);
      if (!existing) return;

      this.updateBatchStatus(existing, 'in_progress');

       // Simulate an auto-switch when the initial number degrades
      if (options.simulateBan && batch.batchIndex === 0) {
        await this.triggerNumberSwitch(options, 'Simulated quality drop during dispatch');
      }

      // Simulate completion after small delay
      setTimeout(async () => {
        const inProgress = this.batches.get(batch.id);
        if (!inProgress || inProgress.status !== 'in_progress') {
          return;
        }

        this.updateBatchStatus(inProgress, 'completed');
        this.logger.debug(
          `Completed dispatch batch ${inProgress.batchIndex + 1}/${inProgress.totalBatches} for campaign ${inProgress.campaignId} (${options.enqueueReason})`,
        );
      }, PROCESSING_SIMULATION_DELAY_MS);
    }, 100);
  }

  private updateBatchStatus(batch: CampaignDispatchBatch, status: DispatchJobStatus) {
    batch.status = status;
    if (status === 'in_progress') {
      batch.startedAt = new Date();
      batch.attempt += 1;
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      batch.finishedAt = new Date();
    }
    this.batches.set(batch.id, { ...batch });
  }

  private async triggerNumberSwitch(options: EnqueueCampaignOptions, reason: string) {
    try {
      const switched = await this.numbersService.manualSwitch(undefined, {
        reason,
      });

      const previous = this.campaignSender.get(options.campaignId) || {
        virtualNumberId: options.assignedNumberId,
        virtualNumberLabel: options.assignedNumberLabel,
        businessNumberId: options.businessNumberId,
        businessNumber: options.businessNumber,
      };

      const updated: DispatchSenderContext = {
        ...previous,
        virtualNumberId: switched.id,
        virtualNumberLabel: switched.phoneNumberId,
        businessNumberId: switched.businessNumber?.id ?? previous.businessNumberId,
        businessNumber:
          switched.businessNumber?.displayPhoneNumber ||
          switched.businessNumber?.businessName ||
          previous.businessNumber,
        switchedAt: new Date(),
        switchReason: reason,
      };

      this.campaignSender.set(options.campaignId, updated);
      this.logger.warn(
        `Auto-switched virtual number for campaign ${options.campaignId} to ${updated.virtualNumberLabel || updated.virtualNumberId} (${reason})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to auto-switch virtual number for campaign ${options.campaignId}: ${(error as Error).message}`,
      );
    }
  }
}
