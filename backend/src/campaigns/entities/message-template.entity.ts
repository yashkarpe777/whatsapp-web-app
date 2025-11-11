import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TemplateStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
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

  @Column({ name: 'sample_parameters', type: 'jsonb', default: () => "'[]'::jsonb" })
  sampleParameters: Record<string, any>[];

  @Column({ type: 'enum', enum: TemplateStatus, default: TemplateStatus.PENDING })
  status: TemplateStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
