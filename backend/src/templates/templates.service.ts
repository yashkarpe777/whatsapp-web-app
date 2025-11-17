import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
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
import {
  ProviderTemplateData,
  ProviderTemplateComponent,
  ProviderTemplateSampleParameter,
  ProviderTemplateVariable,
  TEMPLATE_PROVIDER_CLIENTS,
  TemplateProviderClient,
} from './providers/template-provider.types';
import { validateCampaignMediaSize, CampaignMediaValidationError } from '../campaigns/utils/media-validator';

interface ProviderFieldMap {
  templateIdField: keyof MessageTemplate;
  statusField: keyof MessageTemplate;
  rejectionField: keyof MessageTemplate;
  validationMode: TemplateValidationMode;
  providerNameField?: keyof MessageTemplate;
}

export interface ProviderSyncSummary {
  provider: TemplateProvider;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface TemplatePayloadVariableInput {
  key: string;
  value?: string | number | boolean | null;
}

export type TemplatePayloadVariablesRecord = Record<string, string | number | boolean | null | undefined>;

export interface TemplatePayloadMediaInput {
  mediaUrl?: string | null;
  attachmentUrl?: string | null;
  mediaType?: string | null;
  mimeType?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
}

export interface TemplatePayloadValidationInput {
  variables?: TemplatePayloadVariablesRecord | TemplatePayloadVariableInput[];
  media?: TemplatePayloadMediaInput;
}

export interface TemplateMediaRequirement {
  required: boolean;
  expectedType?: string | null;
  format?: string | null;
}

export interface TemplatePayloadValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredVariables: string[];
  providedVariables: string[];
  templateApprovalStatus: TemplateApprovalStatus;
  mediaRequirement: TemplateMediaRequirement;
}

type ProviderKey = TemplateProvider;

interface ProviderResult {
  status: ProviderValidationStatus;
  externalId?: string | null;
  rejectionReason?: string | null;
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);
  private readonly providerClients: TemplateProviderClient[];
  private readonly providerFieldMap: Record<TemplateProvider, ProviderFieldMap> = {
    [TemplateProvider.META]: {
      templateIdField: 'metaTemplateId',
      statusField: 'metaStatus',
      rejectionField: 'metaRejectionReason',
      validationMode: TemplateValidationMode.META,
    },
    [TemplateProvider.DLT]: {
      templateIdField: 'dltTemplateId',
      statusField: 'dltStatus',
      rejectionField: 'dltRejectionReason',
      validationMode: TemplateValidationMode.DLT,
    },
    [TemplateProvider.BSP]: {
      templateIdField: 'bspTemplateId',
      statusField: 'bspStatus',
      rejectionField: 'bspRejectionReason',
      validationMode: TemplateValidationMode.BSP,
      providerNameField: 'bspProvider',
    },
  };

  constructor(
    @InjectRepository(MessageTemplate)
    private readonly templateRepo: Repository<MessageTemplate>,
    @Optional()
    @Inject(TEMPLATE_PROVIDER_CLIENTS)
    providerClients?: TemplateProviderClient[],
  ) {
    this.providerClients = providerClients ?? [];
  }

  hasEnabledProviderClients(): boolean {
    return this.providerClients.some((client) => client.isEnabled());
  }

  async syncFromProviders(): Promise<ProviderSyncSummary[]> {
    if (!this.providerClients.length) {
      this.logger.debug('No template provider clients registered; skipping sync.');
      return [];
    }

    const summaries: ProviderSyncSummary[] = [];

    for (const client of this.providerClients) {
      const summary: ProviderSyncSummary = {
        provider: client.provider,
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      };

      if (!client.isEnabled()) {
        summary.errors.push('Provider disabled via configuration');
        summaries.push(summary);
        continue;
      }

      try {
        const templates = await client.fetchTemplates();
        summary.fetched = templates.length;

        for (const templateData of templates) {
          const result = await this.upsertTemplateFromProvider(templateData);
          if (result === 'created') {
            summary.created += 1;
          } else if (result === 'updated') {
            summary.updated += 1;
          } else {
            summary.skipped += 1;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.errors.push(message);
        this.logger.error(
          `Template sync failed for provider ${client.provider}: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }

      summaries.push(summary);
    }

    return summaries;
  }

  async validateTemplatePayload(
    templateId: number,
    payload: TemplatePayloadValidationInput,
  ): Promise<TemplatePayloadValidationResult> {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const result: TemplatePayloadValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      requiredVariables: [],
      providedVariables: [],
      templateApprovalStatus: template.approvalStatus,
      mediaRequirement: {
        required: false,
        expectedType: null,
        format: null,
      },
    };

    if (template.approvalStatus !== TemplateApprovalStatus.APPROVED) {
      result.isValid = false;
      result.errors.push(`Template must be approved. Current status: ${template.approvalStatus}`);
    }

    const templateVariables = this.extractTemplateVariableKeys(template);
    result.requiredVariables = templateVariables;

    const providedVariables = this.normalizeProvidedVariables(payload.variables);
    result.providedVariables = providedVariables;

    const missingVariables = templateVariables.filter((key) => !providedVariables.includes(key));
    if (missingVariables.length) {
      result.isValid = false;
      result.errors.push(`Missing variable values for: ${missingVariables.join(', ')}`);
    }

    const mediaRequirement = await this.resolveMediaRequirement(template);
    result.mediaRequirement = mediaRequirement;

    const hasMediaPayload = Boolean(payload.media?.mediaUrl || payload.media?.attachmentUrl);
    if (mediaRequirement.required && !hasMediaPayload) {
      result.isValid = false;
      result.errors.push('Template requires media but none was provided.');
    }

    if (hasMediaPayload) {
      try {
        validateCampaignMediaSize({
          mediaType: payload.media?.mediaType ?? mediaRequirement.expectedType ?? undefined,
          mediaUrl: payload.media?.mediaUrl ?? undefined,
          attachmentUrl: payload.media?.attachmentUrl ?? undefined,
          mediaName: payload.media?.mediaName ?? undefined,
          mimeType: payload.media?.mimeType ?? undefined,
          mediaSize: payload.media?.mediaSize ?? undefined,
        });
      } catch (error) {
        if (error instanceof CampaignMediaValidationError) {
          result.isValid = false;
          result.errors.push(`Media exceeds allowed size for type ${error.mediaType}. Limit: ${error.maxSize} bytes.`);
        } else {
          result.warnings.push('Media validation encountered an unexpected error.');
        }
      }

      if (
        mediaRequirement.expectedType &&
        payload.media?.mediaType &&
        payload.media.mediaType !== mediaRequirement.expectedType
      ) {
        result.warnings.push(
          `Media type mismatch. Expected ${mediaRequirement.expectedType} but received ${payload.media.mediaType}.`,
        );
      }
    }

    return result;
  }

  private async upsertTemplateFromProvider(
    data: ProviderTemplateData,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const fieldMap = this.providerFieldMap[data.provider];
    if (!fieldMap) {
      this.logger.warn(`Provider ${data.provider} is not mapped; skipping template ${data.externalId}`);
      return 'skipped';
    }

    let template = await this.findTemplateForProvider(data, fieldMap);
    const isNew = !template;

    if (!template) {
      template = this.templateRepo.create({
        name: data.name,
        category: data.category ?? null,
        language: data.language ?? 'en_US',
        body: data.body,
        header: data.header ?? null,
        footer: data.footer ?? null,
        ctaButton: data.ctaButton ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        variables: this.mapVariables(data.variables),
        sampleParameters: this.mapSampleParameters(data.sampleParameters),
        validationMode: fieldMap.validationMode,
        bspProvider: fieldMap.providerNameField ? data.providerName ?? null : null,
        createdBy: null,
      });

      this.applyInitialStatuses(template, template.validationMode);
    }

    let changed = false;

    changed = this.assignIfChanged(template, 'name', data.name) || changed;
    changed = this.assignIfChanged(template, 'category', data.category ?? null) || changed;
    changed = this.assignIfChanged(template, 'language', data.language ?? 'en_US') || changed;
    changed = this.assignIfChanged(template, 'body', data.body) || changed;
    changed = this.assignIfChanged(template, 'header', data.header ?? null) || changed;
    changed = this.assignIfChanged(template, 'footer', data.footer ?? null) || changed;
    changed = this.assignIfChanged(template, 'ctaButton', data.ctaButton ?? null) || changed;
    changed = this.assignIfChanged(template, 'attachmentUrl', data.attachmentUrl ?? null) || changed;
    changed =
      this.assignIfChanged(template, 'variables', this.mapVariables(data.variables)) || changed;
    changed =
      this.assignIfChanged(
        template,
        'sampleParameters',
        this.mapSampleParameters(data.sampleParameters),
      ) || changed;

    if (fieldMap.providerNameField) {
      changed =
        this.assignIfChanged(
          template,
          fieldMap.providerNameField,
          data.providerName ?? null,
        ) || changed;
    }

    changed =
      this.assignIfChanged(template, fieldMap.templateIdField, data.externalId ?? null) || changed;
    changed =
      this.assignIfChanged(template, fieldMap.statusField, data.status ?? ProviderValidationStatus.PENDING) ||
      changed;
    changed =
      this.assignIfChanged(template, fieldMap.rejectionField, data.rejectionReason ?? null) || changed;

    // Ensure validation mode reflects provider requirements for existing templates
    if (!isNew) {
      const requiredMode = fieldMap.validationMode;
      if (template.validationMode !== TemplateValidationMode.ALL) {
        if (template.validationMode !== requiredMode) {
          template.validationMode = TemplateValidationMode.ALL;
          changed = true;
        }
      }
    }

    await this.refreshApprovalStatus(template);

    if (!changed && !isNew) {
      return 'skipped';
    }

    await this.templateRepo.save(template);
    return isNew ? 'created' : 'updated';
  }

  private async findTemplateForProvider(
    data: ProviderTemplateData,
    fieldMap: ProviderFieldMap,
  ): Promise<MessageTemplate | null> {
    if (data.externalId) {
      const where: Partial<MessageTemplate> = {
        [fieldMap.templateIdField]: data.externalId,
      } as Partial<MessageTemplate>;
      const existing = await this.templateRepo.findOne({ where });
      if (existing) {
        return existing;
      }
    }

    const fallback = await this.templateRepo.findOne({
      where: {
        name: data.name,
        language: data.language ?? 'en_US',
      },
    });

    return fallback ?? null;
  }

  private mapVariables(variables?: ProviderTemplateVariable[] | null) {
    if (!variables || !variables.length) {
      return null;
    }

    return variables.map((variable) => ({
      key: variable.key,
      sampleValue: variable.sampleValue ?? null,
    }));
  }

  private mapSampleParameters(parameters?: ProviderTemplateSampleParameter[] | null) {
    if (!parameters || !parameters.length) {
      return [];
    }

    return parameters.map((parameter) => ({
      name: parameter.name,
      value: parameter.value ?? null,
    }));
  }

  private assignIfChanged<K extends keyof MessageTemplate>(
    template: MessageTemplate,
    field: K,
    value: MessageTemplate[K],
  ) {
    const current = template[field];
    if (this.valuesEqual(current, value)) {
      return false;
    }

    template[field] = value;
    return true;
  }

  private valuesEqual(a: any, b: any) {
    if (a === b) {
      return true;
    }

    if (a == null || b == null) {
      return a == null && b == null;
    }

    if (typeof a === 'object' || typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return a === b;
  }

  private extractTemplateVariableKeys(template: MessageTemplate): string[] {
    const keys = new Set<string>();

    const addKey = (key: string | null | undefined) => {
      const normalized = this.normalizeVariableKey(key);
      if (normalized) {
        keys.add(normalized);
      }
    };

    if (Array.isArray(template.variables)) {
      template.variables.forEach((variable: Record<string, any>) => addKey(variable?.key));
    }

    if (Array.isArray(template.sampleParameters)) {
      template.sampleParameters.forEach((param: Record<string, any>) => addKey(param?.name));
    }

    if (template.body) {
      const matches = template.body.match(/{{\s*\d+\s*}}/g) ?? [];
      matches.forEach((placeholder) => addKey(placeholder));
    }

    return Array.from(keys);
  }

  private normalizeProvidedVariables(
    variables?: TemplatePayloadVariablesRecord | TemplatePayloadVariableInput[],
  ): string[] {
    if (!variables) {
      return [];
    }

    const keys = new Set<string>();

    const addKey = (key: string | null | undefined) => {
      const normalized = this.normalizeVariableKey(key);
      if (normalized) {
        keys.add(normalized);
      }
    };

    if (Array.isArray(variables)) {
      variables.forEach((variable) => addKey(variable?.key));
    } else {
      Object.entries(variables).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          addKey(key);
        }
      });
    }

    return Array.from(keys);
  }

  private normalizeVariableKey(key?: string | null): string | null {
    if (!key) {
      return null;
    }

    let cleaned = key.trim();
    if (!cleaned) {
      return null;
    }

    const numericMatch = cleaned.match(/^\d+$/);
    if (numericMatch) {
      cleaned = `{{${cleaned}}}`;
    }

    if (!cleaned.startsWith('{{') && /^{{\s*\d+\s*}}$/.test(`{{${cleaned}}}`)) {
      const digits = cleaned.replace(/[^\d]/g, '');
      if (digits) {
        cleaned = `{{${digits}}}`;
      }
    }

    return cleaned;
  }

  private async resolveMediaRequirement(
    template: MessageTemplate,
  ): Promise<TemplateMediaRequirement> {
    const fallbackRequirement: TemplateMediaRequirement = {
      required: false,
      expectedType: null,
      format: null,
    };

    try {
      const components = await this.resolveTemplateComponents(template);
      if (components && components.length) {
        const headerComponent = components.find((component) => component.type === 'HEADER');
        const format = headerComponent?.format ?? null;
        if (format) {
          const expectedType = format.toLowerCase();
          if (['image', 'video', 'document', 'audio'].includes(expectedType)) {
            return {
              required: true,
              expectedType,
              format,
            };
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to resolve template components for media requirement: ${error}`);
    }

    if (template.attachmentUrl) {
      const inferredType = this.inferMediaTypeFromAttachment(template.attachmentUrl);
      return {
        required: true,
        expectedType: inferredType,
        format: inferredType ? inferredType.toUpperCase() : null,
      };
    }

    return fallbackRequirement;
  }

  private async resolveTemplateComponents(
    template: MessageTemplate,
  ): Promise<ProviderTemplateComponent[] | null> {
    if (!this.providerClients.length) {
      return null;
    }

    const providerTargets: Array<{ provider: TemplateProvider; externalId?: string | null }> = [
      { provider: TemplateProvider.META, externalId: template.metaTemplateId },
      { provider: TemplateProvider.DLT, externalId: template.dltTemplateId },
      { provider: TemplateProvider.BSP, externalId: template.bspTemplateId },
    ];

    for (const target of providerTargets) {
      if (!target.externalId) {
        continue;
      }

      const client = this.providerClients.find((providerClient) => providerClient.provider === target.provider);
      if (!client || typeof client.getTemplateComponents !== 'function') {
        continue;
      }

      try {
        const components = await client.getTemplateComponents(target.externalId);
        if (components && components.length) {
          return components;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to fetch template components from provider ${target.provider}: ${message}`,
        );
      }
    }

    return null;
  }

  private inferMediaTypeFromAttachment(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }

    const lowerUrl = url.toLowerCase();
    const extension = lowerUrl.split('?')[0].split('#')[0].split('.').pop() ?? '';

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const videoExts = ['mp4', 'mov', 'wmv', 'avi', 'mkv'];
    const audioExts = ['mp3', 'aac', 'ogg', 'wav', 'm4a'];
    const documentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

    if (imageExts.includes(extension)) {
      return 'image';
    }
    if (videoExts.includes(extension)) {
      return 'video';
    }
    if (audioExts.includes(extension)) {
      return 'audio';
    }
    if (documentExts.includes(extension)) {
      return 'document';
    }

    return null;
  }

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
