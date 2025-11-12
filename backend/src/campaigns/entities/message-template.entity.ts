import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TemplateApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ProviderValidationStatus {
  NOT_REQUIRED = 'not_required',
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export enum TemplateValidationMode {
  META = 'meta',
  DLT = 'dlt',
  BSP = 'bsp',
  ALL = 'all',
}

@Entity('message_templates')
export class MessageTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150, unique: true })
  name: string;

  @Column({ length: 60, nullable: true })
  category?: string | null;

  @Column({ length: 10, default: 'en_US' })
  language: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  header?: string | null;

  @Column({ type: 'text', nullable: true })
  footer?: string | null;

  @Column({ name: 'cta_button', type: 'jsonb', nullable: true })
  ctaButton?: Record<string, any> | null;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl?: string | null;

  @Column({ name: 'variables', type: 'jsonb', nullable: true })
  variables?: Record<string, any>[] | null;

  @Column({ name: 'sample_parameters', type: 'jsonb', default: () => "'[]'::jsonb" })
  sampleParameters: Record<string, any>[];

  @Column({ name: 'validation_mode', type: 'enum', enum: TemplateValidationMode, default: TemplateValidationMode.META })
  validationMode: TemplateValidationMode;

  @Column({ name: 'bsp_provider', length: 120, nullable: true })
  bspProvider?: string | null;

  @Column({ name: 'meta_template_id', length: 120, nullable: true })
  metaTemplateId?: string | null;

  @Column({ name: 'dlt_template_id', length: 120, nullable: true })
  dltTemplateId?: string | null;

  @Column({ name: 'bsp_template_id', length: 120, nullable: true })
  bspTemplateId?: string | null;

  @Column({ name: 'meta_status', type: 'enum', enum: ProviderValidationStatus, default: ProviderValidationStatus.PENDING })
  metaStatus: ProviderValidationStatus;

  @Column({ name: 'meta_rejection_reason', type: 'text', nullable: true })
  metaRejectionReason?: string | null;

  @Column({ name: 'dlt_status', type: 'enum', enum: ProviderValidationStatus, default: ProviderValidationStatus.NOT_REQUIRED })
  dltStatus: ProviderValidationStatus;

  @Column({ name: 'dlt_rejection_reason', type: 'text', nullable: true })
  dltRejectionReason?: string | null;

  @Column({ name: 'bsp_status', type: 'enum', enum: ProviderValidationStatus, default: ProviderValidationStatus.NOT_REQUIRED })
  bspStatus: ProviderValidationStatus;

  @Column({ name: 'bsp_rejection_reason', type: 'text', nullable: true })
  bspRejectionReason?: string | null;

  @Column({ name: 'approval_status', type: 'enum', enum: TemplateApprovalStatus, default: TemplateApprovalStatus.PENDING })
  approvalStatus: TemplateApprovalStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
