import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProviderTemplateComponent,
  ProviderTemplateData,
  ProviderTemplateSampleParameter,
  ProviderTemplateVariable,
  TemplateProviderClient,
  TemplateValidationResult,
} from './template-provider.types';
import { ProviderValidationStatus } from '../../campaigns/entities/message-template.entity';
import { TemplateProvider } from '../dto/template-status-webhook.dto';

type MetaTemplateStatus =
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'PAUSED'
  | 'LIMITED'
  | string;

type MetaComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';

interface MetaTemplateComponent {
  type: MetaComponentType;
  format?: string;
  text?: string;
  buttons?: Array<Record<string, any>>;
  example?: {
    header_handle?: string[];
    header_text?: string[];
    body_text?: string[][];
    footer_text?: string[];
  };
}

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category?: string;
  status?: MetaTemplateStatus;
  rejection_reasons?: string[];
  components?: MetaTemplateComponent[];
  quality_score?: {
    score?: string;
  };
}

@Injectable()
export class MetaTemplateProviderClient implements TemplateProviderClient {
  readonly provider = TemplateProvider.META;
  private readonly logger = new Logger(MetaTemplateProviderClient.name);
  private readonly baseUrl: string;
  private readonly accessToken?: string;
  private readonly wabaId?: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('META_API_BASE_URL') || 'https://graph.facebook.com/v17.0').replace(/\/$/, '');
    this.accessToken = this.configService.get<string>('META_ACCESS_TOKEN');
    this.wabaId = this.configService.get<string>('META_WABA_ID');
  }

  isEnabled(): boolean {
    return Boolean(this.accessToken && this.wabaId);
  }

  async fetchTemplates(): Promise<ProviderTemplateData[]> {
    if (!this.isEnabled()) {
      this.logger.debug('Meta provider not configured; skipping fetchTemplates.');
      return [];
    }

    const response = await this.request<{ data?: MetaTemplate[] }>(`${this.wabaId}/message_templates`, {
      fields: 'id,name,language,status,category,rejection_reasons,components,quality_score',
      limit: '100',
    });

    const templates = response.data ?? [];
    return templates.map((template) => this.mapTemplate(template)).filter(Boolean) as ProviderTemplateData[];
  }

  async fetchTemplateStatus(externalId: string): Promise<ProviderTemplateData | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const template = await this.request<MetaTemplate>(externalId, {
      fields: 'id,name,language,status,category,rejection_reasons,components,quality_score',
    });

    if (!template?.id) {
      return null;
    }

    return this.mapTemplate(template);
  }

  async validateTemplate(externalId: string): Promise<TemplateValidationResult> {
    const template = await this.fetchTemplateStatus(externalId);
    if (!template) {
      return {
        isValid: false,
        status: ProviderValidationStatus.FAILED,
        rejectionReason: 'Template not found in Meta',
      };
    }

    const approved = template.status === ProviderValidationStatus.APPROVED;
    return {
      isValid: approved,
      status: template.status,
      rejectionReason: template.rejectionReason ?? null,
      raw: template.raw,
    };
  }

  async getTemplateComponents(externalId: string): Promise<ProviderTemplateComponent[]> {
    const template = await this.fetchTemplateStatus(externalId);
    const rawComponents = (template?.raw?.components as MetaTemplateComponent[] | undefined) ?? [];
    return this.mapComponents(rawComponents);
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Meta access token is not configured');
    }

    const url = new URL(`${this.baseUrl}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
    } as Record<string, string>;

    const fetchFn: typeof fetch | undefined = (globalThis as any).fetch;
    if (!fetchFn) {
      throw new Error('Global fetch API not available; please run on Node.js 18+');
    }

    const response = await fetchFn(url.toString(), { headers });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Meta API request failed (${response.status}): ${body}`);
    }

    return (await response.json()) as T;
  }

  private mapTemplate(template: MetaTemplate): ProviderTemplateData {
    const components = template.components ?? [];
    const bodyComponent = components.find((component) => component.type === 'BODY');
    const headerComponent = components.find((component) => component.type === 'HEADER');
    const footerComponent = components.find((component) => component.type === 'FOOTER');
    const buttonsComponent = components.find((component) => component.type === 'BUTTONS');

    const variables = this.extractVariables(bodyComponent);
    const sampleParameters = this.buildSampleParameters(variables);
    const providerComponents = this.mapComponents(components);

    return {
      provider: this.provider,
      externalId: template.id,
      name: template.name,
      language: template.language,
      body: bodyComponent?.text ?? '',
      header: headerComponent?.text ?? null,
      footer: footerComponent?.text ?? null,
      ctaButton: buttonsComponent ? { buttons: buttonsComponent.buttons ?? [] } : null,
      attachmentUrl: this.extractAttachment(headerComponent),
      category: template.category ?? null,
      providerName: 'meta',
      status: this.mapStatus(template.status),
      rejectionReason: this.joinRejectionReasons(template.rejection_reasons),
      variables,
      sampleParameters,
      raw: {
        ...template,
        components: providerComponents,
      } as unknown as Record<string, any>,
    };
  }

  private mapStatus(status?: MetaTemplateStatus): ProviderValidationStatus {
    switch (status) {
      case 'APPROVED':
        return ProviderValidationStatus.APPROVED;
      case 'REJECTED':
        return ProviderValidationStatus.REJECTED;
      case 'IN_REVIEW':
      case 'PENDING':
        return ProviderValidationStatus.PENDING;
      case 'LIMITED':
      case 'PAUSED':
        return ProviderValidationStatus.FAILED;
      default:
        return ProviderValidationStatus.PENDING;
    }
  }

  private joinRejectionReasons(reasons?: string[]): string | null {
    if (!reasons || !reasons.length) {
      return null;
    }
    return reasons.join(', ');
  }

  private extractAttachment(component?: MetaTemplateComponent): string | null {
    if (!component?.example?.header_handle?.length) {
      return null;
    }
    return component.example.header_handle[0];
  }

  private extractVariables(component?: MetaTemplateComponent): ProviderTemplateVariable[] {
    if (!component?.text) {
      return [];
    }

    const matches = component.text.match(/{{\d+}}/g);
    if (!matches) {
      return [];
    }

    const seen = new Set<string>();
    const examples = Array.isArray(component.example?.body_text)
      ? component.example?.body_text[0] ?? []
      : [];

    return matches
      .filter((placeholder) => {
        if (seen.has(placeholder)) {
          return false;
        }
        seen.add(placeholder);
        return true;
      })
      .map((placeholder) => {
        const index = Number(placeholder.replace(/[^\d]/g, '')) - 1;
        return {
          key: placeholder,
          sampleValue: examples[index] ?? null,
        };
      });
  }

  private buildSampleParameters(
    variables: ProviderTemplateVariable[],
  ): ProviderTemplateSampleParameter[] {
    return variables.map((variable) => ({
      name: variable.key,
      value: variable.sampleValue ?? undefined,
    }));
  }

  private mapComponents(components: MetaTemplateComponent[]): ProviderTemplateComponent[] {
    if (!components || !components.length) {
      return [];
    }

    return components.map((component) => ({
      type: component.type,
      format: component.format ?? null,
      text: component.text ?? null,
      buttons: component.buttons ?? null,
      example: component.example ?? null,
    }));
  }
}
