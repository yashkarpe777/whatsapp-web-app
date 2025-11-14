import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import {
  CampaignDispatchBatch,
  DispatchJobStatus,
  EnqueueCampaignOptions,
  EnqueueCampaignResult,
  DispatchSenderContext,
} from './types/dispatch-job';
import { NumbersService } from '../numbers/numbers.service';
import { Repository, EntityManager } from 'typeorm';
import { CampaignJob } from './entities/campaign-job.entity';
import { SentMessage } from './entities/sent-message.entity';

const DEFAULT_BATCH_SIZE = 1000;
const PROCESSING_SIMULATION_DELAY_MS = 1500;

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly campaignSender = new Map<number, DispatchSenderContext>();

  constructor(
    private readonly numbersService: NumbersService,
    @InjectRepository(CampaignJob)
    private readonly campaignJobRepo: Repository<CampaignJob>,
    @InjectRepository(SentMessage)
    private readonly sentMessageRepo: Repository<SentMessage>,
  ) {}

  async enqueueCampaign(
    options: EnqueueCampaignOptions,
    manager?: EntityManager,
  ): Promise<EnqueueCampaignResult> {
    if (manager) {
      return this.enqueueWithManager(manager, options);
    }

    return this.campaignJobRepo.manager.transaction((transactionManager) =>
      this.enqueueWithManager(transactionManager, options),
    );
  }

  async getBatch(jobId: string): Promise<CampaignDispatchBatch | undefined> {
    const job = await this.campaignJobRepo.findOne({ where: { jobId } });
    return job ? this.mapJobToDispatchBatch(job) : undefined;
  }

  async listCampaignBatches(campaignId: number): Promise<CampaignDispatchBatch[]> {
    const jobs = await this.campaignJobRepo.find({
      where: { campaignId },
      order: { batchIndex: 'ASC' },
    });
    return jobs.map((job) => this.mapJobToDispatchBatch(job));
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

  private async enqueueWithManager(
    manager: EntityManager,
    options: EnqueueCampaignOptions,
  ): Promise<EnqueueCampaignResult> {
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const totalBatches = Math.max(1, Math.ceil(options.recipientsCount / batchSize));

    const initialSender: DispatchSenderContext = {
      virtualNumberId: options.assignedNumberId,
      virtualNumberLabel: options.assignedNumberLabel,
      businessNumberId: options.businessNumberId,
      businessNumber: options.businessNumber,
    };

    this.campaignSender.set(options.campaignId, initialSender);

    const jobRepo = manager.getRepository(CampaignJob);
    const jobs: CampaignJob[] = [];
    const jobIds: string[] = [];

    for (let index = 0; index < totalBatches; index++) {
      const jobId = this.generateJobId(options.campaignId);
      jobIds.push(jobId);

      const entity = jobRepo.create({
        campaignId: options.campaignId,
        userId: options.userId,
        virtualNumberId: options.assignedNumberId,
        virtualNumberLabel: options.assignedNumberLabel,
        businessNumberId: options.businessNumberId,
        businessNumber: options.businessNumber,
        caption: options.messagePayload?.caption ?? null,
        mediaUrl: options.messagePayload?.media_url ?? null,
        mediaType: options.messagePayload?.media_type ?? null,
        mediaName: options.messagePayload?.media_name ?? null,
        cta: options.messagePayload?.cta ?? null,
        jobId,
        batchIndex: index,
        totalBatches,
        size: this.resolveBatchSize(index, totalBatches, options.recipientsCount, batchSize),
        status: 'queued',
        attempt: 0,
      });

      jobs.push(entity);
    }

    const savedJobs = await jobRepo.save(jobs);
    const batches = savedJobs.map((job) => this.mapJobToDispatchBatch(job));
    const estimatedDurationSeconds = totalBatches * PROCESSING_SIMULATION_DELAY_MS * 0.001;

    this.logger.log(
      `Enqueued ${totalBatches} batch(es) for campaign ${options.campaignId} (user ${options.userId}) via ${options.enqueueReason}`,
    );

    return {
      jobIds,
      totalBatches,
      batchSize,
      estimatedDurationSeconds,
      batches,
      sender: { ...initialSender },
    };
  }

  private mapJobToDispatchBatch(job: CampaignJob): CampaignDispatchBatch {
    return {
      id: job.jobId,
      campaignId: job.campaignId,
      userId: job.userId,
      batchIndex: job.batchIndex,
      totalBatches: job.totalBatches,
      size: job.size,
      createdAt: job.queuedAt,
      startedAt: job.startedAt ?? undefined,
      finishedAt: job.finishedAt ?? undefined,
      status: job.status,
      attempt: job.attempt,
      error: job.error ?? undefined,
    };
  }
}
