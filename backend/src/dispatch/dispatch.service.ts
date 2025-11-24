import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import {
  CampaignDispatchBatch,
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

  private async enqueueWithManager(
    manager: EntityManager,
    options: EnqueueCampaignOptions,
  ): Promise<EnqueueCampaignResult> {
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const totalBatches = Math.max(1, Math.ceil(options.recipientsCount / batchSize));

    const jobRepo = manager.getRepository(CampaignJob);
    const jobs: CampaignJob[] = [];
    const jobIds: string[] = [];

    const rotationHistory: DispatchSenderContext[] = [];

    for (let index = 0; index < totalBatches; index++) {
      const jobId = this.generateJobId(options.campaignId);
      jobIds.push(jobId);

      const rotationReason = index === 0 ? 'initial dispatch allocation' : `rotation for batch ${index + 1}`;

      const selectionOptions = {
        excludeIds: index === 0 ? [] : rotationHistory.map((context) => context.virtualNumberId),
        maxMessageCount24h: options.batchSize,
        cooldownMinutes: 5,
      } as const;

      const selectedNumber = await this.numbersService.selectRandomActiveNumber(selectionOptions);

      if (!selectedNumber) {
        throw new Error('No eligible virtual numbers available during dispatch enqueue');
      }

      const senderContext: DispatchSenderContext = {
        virtualNumberId: selectedNumber.id,
        virtualNumberLabel: selectedNumber.phoneNumberId,
        businessNumberId: selectedNumber.businessNumber?.id,
        businessNumber:
          selectedNumber.businessNumber?.displayPhoneNumber ||
          selectedNumber.businessNumber?.businessName ||
          options.businessNumber,
        switchedAt: new Date(),
        switchReason: rotationReason,
      };

      rotationHistory.push(senderContext);

      this.logger.log(
        `Batch ${index + 1}/${totalBatches} for campaign ${options.campaignId} assigned to virtual number ${senderContext.virtualNumberLabel || senderContext.virtualNumberId} (${rotationReason})`,
      );

      const entity = jobRepo.create({
        campaignId: options.campaignId,
        userId: options.userId,
        virtualNumberId: senderContext.virtualNumberId,
        virtualNumberLabel: senderContext.virtualNumberLabel,
        businessNumberId: senderContext.businessNumberId,
        businessNumber: senderContext.businessNumber,
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

    const finalSender = rotationHistory[rotationHistory.length - 1];
    if (finalSender) {
      this.campaignSender.set(options.campaignId, finalSender);
    }

    return {
      jobIds,
      totalBatches,
      batchSize,
      estimatedDurationSeconds,
      batches,
      sender: finalSender
        ? { ...finalSender }
        : {
            virtualNumberId: options.assignedNumberId,
            virtualNumberLabel: options.assignedNumberLabel,
            businessNumberId: options.businessNumberId,
            businessNumber: options.businessNumber,
          },
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
