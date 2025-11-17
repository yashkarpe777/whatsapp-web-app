import { ProviderValidationStatus } from '../../campaigns/entities/message-template.entity';
import { TemplateProvider } from '../dto/template-status-webhook.dto';

export const TEMPLATE_PROVIDER_CLIENTS = Symbol('TEMPLATE_PROVIDER_CLIENTS');

export interface ProviderTemplateVariable {
  key: string;
  sampleValue?: string | null;
}

export interface ProviderTemplateSampleParameter {
  name: string;
  value?: string | null;
}

export interface ProviderTemplateData {
  provider: TemplateProvider;
  externalId: string;
  name: string;
  language: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  ctaButton?: Record<string, any> | null;
  attachmentUrl?: string | null;
  category?: string | null;
  providerName?: string | null;
  status: ProviderValidationStatus;
  rejectionReason?: string | null;
  variables: ProviderTemplateVariable[];
  sampleParameters: ProviderTemplateSampleParameter[];
  raw?: Record<string, any>;
}

export interface ProviderTemplateComponent {
  type: string;
  format?: string | null;
  text?: string | null;
  buttons?: Record<string, any>[] | null;
  example?: Record<string, any> | null;
}

export interface TemplateValidationResult {
  isValid: boolean;
  status?: ProviderValidationStatus;
  rejectionReason?: string | null;
  raw?: Record<string, any>;
}

export interface TemplateProviderClient {
  readonly provider: TemplateProvider;
  isEnabled(): boolean;
  fetchTemplates(): Promise<ProviderTemplateData[]>;
  fetchTemplateStatus(externalId: string): Promise<ProviderTemplateData | null>;
  validateTemplate?(externalId: string): Promise<TemplateValidationResult>;
  getTemplateComponents?(externalId: string): Promise<ProviderTemplateComponent[]>;
}
