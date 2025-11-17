import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { SentMessage } from '../../dispatch/entities/sent-message.entity';
import { CampaignJob } from '../../dispatch/entities/campaign-job.entity';
import { MEDIA_CLEANUP_QUEUE } from '../queue.constants';
import { MediaCleanupPayload } from '../cleanup.service';

@Processor(MEDIA_CLEANUP_QUEUE)
export class MediaCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaCleanupProcessor.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(SentMessage)
    private readonly sentMessageRepo: Repository<SentMessage>,
    @InjectRepository(CampaignJob)
    private readonly campaignJobRepo: Repository<CampaignJob>,
  ) {
    super();
  }

  async process(job: Job<MediaCleanupPayload>): Promise<void> {
    const { campaignId } = job.data;
    if (!campaignId) {
      this.logger.warn('Received media cleanup job without campaignId');
      return;
    }

    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found for media cleanup`);
      return;
    }

    const fileCandidates = new Set<string>();
    (job.data.mediaPaths ?? []).forEach((candidate) => candidate && fileCandidates.add(candidate));
    [campaign.media_url, campaign.attachmentUrl].forEach((candidate) => candidate && fileCandidates.add(candidate));

    for (const candidate of fileCandidates) {
      const localPath = this.resolveLocalPath(candidate);
      if (!localPath) {
        continue;
      }

      try {
        await fs.unlink(localPath);
        this.logger.log(`Deleted media file ${localPath} for campaign ${campaignId}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.warn(`Failed to delete media file ${localPath}: ${(error as Error).message}`);
        }
      }
    }

    await this.campaignRepo.update(campaignId, {
      caption: null,
      media_url: null,
      media_name: null,
      media_type: null,
      attachmentUrl: null,
      ctaButtons: [],
    });

    await this.sentMessageRepo
      .createQueryBuilder()
      .update()
      .set({ caption: null, mediaUrl: null, mediaType: null, mediaName: null, cta: null })
      .where('campaign_id = :campaignId', { campaignId })
      .execute();

    await this.campaignJobRepo
      .createQueryBuilder()
      .update()
      .set({ caption: null, mediaUrl: null, mediaType: null, mediaName: null, cta: null })
      .where('campaign_id = :campaignId', { campaignId })
      .execute();
  }

  private resolveLocalPath(candidate: string): string | null {
    if (!candidate) {
      return null;
    }

    try {
      const maybeUrl = new URL(candidate);
      if (maybeUrl.protocol.startsWith('http')) {
        return null;
      }
    } catch (_) {
      // not a full URL, treat as local
    }

    const normalized = candidate.startsWith('/') ? candidate : path.join(process.cwd(), candidate);
    return normalized;
  }
}
