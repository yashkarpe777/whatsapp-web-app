import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { WebhookLog } from '../entities/webhook-log.entity';

export interface CreateWebhookLogInput {
  eventType?: string | null;
  payload?: Record<string, any> | null;
  statusCode?: number | null;
}

@Injectable()
export class WebhookLogsService {
  constructor(
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
  ) {}

  async createLog(input: CreateWebhookLogInput): Promise<WebhookLog> {
    const entry = this.webhookLogRepository.create({
      eventType: input.eventType ?? null,
      payload: input.payload ?? null,
      statusCode: input.statusCode ?? null,
    });

    return this.webhookLogRepository.save(entry);
  }

  async findRecent(options?: {
    eventType?: string;
    limit?: number;
  }): Promise<WebhookLog[]> {
    const where: FindOptionsWhere<WebhookLog> = {};

    if (options?.eventType) {
      where.eventType = options.eventType;
    }

    const limit = options?.limit ?? 50;

    return this.webhookLogRepository.find({
      where,
      order: { receivedAt: 'DESC' },
      take: limit,
    });
  }
}
