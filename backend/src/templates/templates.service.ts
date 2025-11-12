import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessageTemplate,
  ProviderValidationStatus,
  TemplateApprovalStatus,
  TemplateValidationMode,
} from '../campaigns/entities/message-template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateStatusDto } from './dto/update-template-status.dto';
import {
  TemplateProvider,
  TemplateStatusWebhookDto,
} from './dto/template-status-webhook.dto';
import { User } from '../auth/entities/user.entity';

type ProviderKey = TemplateProvider;

interface ProviderResult {
  status: ProviderValidationStatus;
  externalId?: string | null;
  rejectionReason?: string | null;
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectRepository(MessageTemplate)
    private readonly templateRepo: Repository<MessageTemplate>,
  ) {}

  async createTemplate(dto: CreateTemplateDto, creator: User): Promise<MessageTemplate> {
    const validationMode = dto.validationMode ?? TemplateValidationMode.META;
    const template = this.templateRepo.create({
      name: dto.name,
      category: dto.category ?? null,
      language: dto.language ?? 'en_US',
      body: dto.body,
      header: dto.header ?? null,
      footer: dto.footer ?? null,
      ctaButton: dto.ctaButton ?? null,
      attachmentUrl: dto.attachmentUrl ?? null,
      variables: dto.variables
        ? dto.variables.map((variable) => ({
            key: variable.key,
            sampleValue: variable.sampleValue ?? null,
          }))
        : null,
      sampleParameters: dto.sampleParameters
        ? dto.sampleParameters.map((parameter) => ({
            name: parameter.name,
            value: parameter.value ?? null,
          }))
        : [],
      validationMode,
      bspProvider: dto.bspProvider ?? null,
      createdBy: creator?.id ?? null,
    });

    this.applyInitialStatuses(template, validationMode);

    const saved = await this.templateRepo.save(template);
    this.scheduleValidation(saved.id);
    return saved;
  }

  async listAll(): Promise<MessageTemplate[]> {
    return this.templateRepo.find({ order: { createdAt: 'DESC' } });
  }

  async listApproved(): Promise<MessageTemplate[]> {
    return this.templateRepo.find({
      where: { approvalStatus: TemplateApprovalStatus.APPROVED },
      order: { updatedAt: 'DESC' },
    });
  }

  async getById(id: number): Promise<MessageTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return template;
  }

  async updateStatus(id: number, dto: UpdateTemplateStatusDto): Promise<MessageTemplate> {
    const template = await this.getById(id);

    if (dto.metaStatus) {
      template.metaStatus = dto.metaStatus;
      template.metaRejectionReason = dto.metaRejectionReason ?? null;
    }
    if (dto.metaTemplateId !== undefined) {
      template.metaTemplateId = dto.metaTemplateId ?? null;
    }

    if (dto.dltStatus) {
      template.dltStatus = dto.dltStatus;
      template.dltRejectionReason = dto.dltRejectionReason ?? null;
    }
    if (dto.dltTemplateId !== undefined) {
      template.dltTemplateId = dto.dltTemplateId ?? null;
    }

    if (dto.bspStatus) {
      template.bspStatus = dto.bspStatus;
      template.bspRejectionReason = dto.bspRejectionReason ?? null;
    }
    if (dto.bspTemplateId !== undefined) {
      template.bspTemplateId = dto.bspTemplateId ?? null;
    }
    if (dto.bspProvider !== undefined) {
      template.bspProvider = dto.bspProvider ?? null;
    }

    if (dto.validationMode) {
      template.validationMode = dto.validationMode;
    }

    await this.refreshApprovalStatus(template);
    return this.templateRepo.save(template);
  }

  async handleProviderWebhook(dto: TemplateStatusWebhookDto): Promise<{ updated: boolean }> {
    const template = await this.resolveTemplateFromWebhook(dto);

    if (!template) {
      this.logger.warn(`Template not found for webhook payload: ${JSON.stringify(dto)}`);
      return { updated: false };
    }

    this.applyProviderUpdate(template, dto.provider, {
      status: dto.status,
      rejectionReason: dto.rejectionReason ?? null,
      externalId: dto.providerTemplateId ?? null,
    });

    await this.refreshApprovalStatus(template);
    await this.templateRepo.save(template);
    return { updated: true };
  }

  private applyInitialStatuses(template: MessageTemplate, mode: TemplateValidationMode) {
    const { needsMeta, needsDlt, needsBsp } = this.resolveValidationRequirements(mode);

    if (needsMeta) {
      template.metaStatus = ProviderValidationStatus.PENDING;
    } else {
      template.metaStatus = ProviderValidationStatus.NOT_REQUIRED;
    }

    if (needsDlt) {
      template.dltStatus = ProviderValidationStatus.PENDING;
    } else {
      template.dltStatus = ProviderValidationStatus.NOT_REQUIRED;
    }

    if (needsBsp) {
      template.bspStatus = ProviderValidationStatus.PENDING;
    } else {
      template.bspStatus = ProviderValidationStatus.NOT_REQUIRED;
    }

    template.approvalStatus = TemplateApprovalStatus.PENDING;
    template.metaRejectionReason = null;
    template.dltRejectionReason = null;
    template.bspRejectionReason = null;
    template.rejectionReason = null;
  }

  private scheduleValidation(templateId: number) {
    setTimeout(() => {
      this.runValidation(templateId).catch((error) =>
        this.logger.error(`Validation failed for template ${templateId}`, error.stack),
      );
    }, 0);
  }

  async runValidationJob(templateId: number) {
    await this.runValidation(templateId);
  }

  private async runValidation(templateId: number) {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) {
      return;
    }

    const { needsMeta, needsDlt, needsBsp } = this.resolveValidationRequirements(
      template.validationMode,
    );

    const updates: Partial<MessageTemplate> = {};
    if (needsMeta) {
      updates.metaStatus = ProviderValidationStatus.IN_PROGRESS;
    }
    if (needsDlt) {
      updates.dltStatus = ProviderValidationStatus.IN_PROGRESS;
    }
    if (needsBsp) {
      updates.bspStatus = ProviderValidationStatus.IN_PROGRESS;
    }

    if (Object.keys(updates).length) {
      await this.templateRepo.update(templateId, updates);
      Object.assign(template, updates);
    }

    if (needsMeta) {
      const result = await this.validateTemplateMeta(template);
      this.applyProviderResult(template, TemplateProvider.META, result);
    }

    if (needsDlt) {
      const result = await this.validateTemplateDLT(template);
      this.applyProviderResult(template, TemplateProvider.DLT, result);
    }

    if (needsBsp) {
      const result = await this.validateTemplateBSP(template);
      this.applyProviderResult(template, TemplateProvider.BSP, result);
    }

    await this.refreshApprovalStatus(template);
    await this.templateRepo.save(template);
  }

  private applyProviderResult(
    template: MessageTemplate,
    provider: ProviderKey,
    result: ProviderResult,
  ) {
    this.applyProviderUpdate(template, provider, result);
  }

  private applyProviderUpdate(
    template: MessageTemplate,
    provider: ProviderKey,
    result: ProviderResult,
  ) {
    if (provider === TemplateProvider.META) {
      template.metaStatus = result.status;
      template.metaTemplateId = result.externalId ?? template.metaTemplateId ?? null;
      template.metaRejectionReason = result.rejectionReason ?? null;
    }
    if (provider === TemplateProvider.DLT) {
      template.dltStatus = result.status;
      template.dltTemplateId = result.externalId ?? template.dltTemplateId ?? null;
      template.dltRejectionReason = result.rejectionReason ?? null;
    }
    if (provider === TemplateProvider.BSP) {
      template.bspStatus = result.status;
      template.bspTemplateId = result.externalId ?? template.bspTemplateId ?? null;
      template.bspRejectionReason = result.rejectionReason ?? null;
    }
  }

  private async refreshApprovalStatus(template: MessageTemplate) {
    const { needsMeta, needsDlt, needsBsp } = this.resolveValidationRequirements(
      template.validationMode,
    );

    const relevantStatuses: ProviderValidationStatus[] = [];
    if (needsMeta) {
      relevantStatuses.push(template.metaStatus);
    }
    if (needsDlt) {
      relevantStatuses.push(template.dltStatus);
    }
    if (needsBsp) {
      relevantStatuses.push(template.bspStatus);
    }

    const hasFailure = relevantStatuses.some((status) =>
      [ProviderValidationStatus.REJECTED, ProviderValidationStatus.FAILED].includes(status),
    );

    const allApproved =
      relevantStatuses.length > 0 &&
      relevantStatuses.every((status) => status === ProviderValidationStatus.APPROVED);

    if (hasFailure) {
      template.approvalStatus = TemplateApprovalStatus.REJECTED;
    } else if (allApproved) {
      template.approvalStatus = TemplateApprovalStatus.APPROVED;
    } else {
      template.approvalStatus = TemplateApprovalStatus.PENDING;
    }

    const reasons = [
      template.metaRejectionReason,
      template.dltRejectionReason,
      template.bspRejectionReason,
    ].filter((reason) => !!reason);

    template.rejectionReason = reasons.length ? reasons.join(' | ') : null;
  }

  private resolveValidationRequirements(mode: TemplateValidationMode) {
    return {
      needsMeta:
        mode === TemplateValidationMode.META || mode === TemplateValidationMode.ALL,
      needsDlt:
        mode === TemplateValidationMode.DLT || mode === TemplateValidationMode.ALL,
      needsBsp:
        mode === TemplateValidationMode.BSP || mode === TemplateValidationMode.ALL,
    };
  }

  private async validateTemplateMeta(
    template: MessageTemplate,
  ): Promise<ProviderResult> {
    await this.delay(500);
    return {
      status: ProviderValidationStatus.APPROVED,
      externalId: template.metaTemplateId ?? `meta_${template.id}_${Date.now()}`,
    };
  }

  private async validateTemplateDLT(
    template: MessageTemplate,
  ): Promise<ProviderResult> {
    await this.delay(700);
    return {
      status: ProviderValidationStatus.APPROVED,
      externalId: template.dltTemplateId ?? `dlt_${template.id}_${Date.now()}`,
    };
  }

  private async validateTemplateBSP(
    template: MessageTemplate,
  ): Promise<ProviderResult> {
    await this.delay(700);
    if (!template.bspProvider) {
      return {
        status: ProviderValidationStatus.FAILED,
        rejectionReason: 'BSP provider configuration missing',
      };
    }

    return {
      status: ProviderValidationStatus.APPROVED,
      externalId: template.bspTemplateId ?? `bsp_${template.id}_${Date.now()}`,
    };
  }

  private async resolveTemplateFromWebhook(
    dto: TemplateStatusWebhookDto,
  ): Promise<MessageTemplate | null> {
    if (dto.templateId) {
      const template = await this.templateRepo.findOne({ where: { id: dto.templateId } });
      if (template) {
        return template;
      }
    }

    if (dto.providerTemplateId) {
      const whereClause = this.buildProviderTemplateLookup(dto.provider, dto.providerTemplateId);
      if (whereClause) {
        return this.templateRepo.findOne({ where: whereClause });
      }
    }

    return null;
  }

  private buildProviderTemplateLookup(provider: ProviderKey, externalId: string) {
    if (provider === TemplateProvider.META) {
      return { metaTemplateId: externalId };
    }
    if (provider === TemplateProvider.DLT) {
      return { dltTemplateId: externalId };
    }
    if (provider === TemplateProvider.BSP) {
      return { bspTemplateId: externalId };
    }
    return null;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
