import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_logs')
export class WebhookLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_type', length: 128, nullable: true })
  eventType?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, any> | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode?: number | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
