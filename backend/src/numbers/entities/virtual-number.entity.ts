import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BusinessNumber } from './business-number.entity';
import { VirtualNumberQuality, VirtualNumberStatus } from '../enums';

@Entity('virtual_numbers')
@Index(['isPrimary'])
export class VirtualNumber {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BusinessNumber, (businessNumber: BusinessNumber) => businessNumber.virtualNumbers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'business_number_id' })
  businessNumber?: BusinessNumber | null;

  @Column({ name: 'waba_id', length: 64 })
  wabaId: string;

  @Column({ name: 'phone_number_id', length: 64, unique: true })
  phoneNumberId: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({
    type: 'enum',
    enum: VirtualNumberStatus,
    default: VirtualNumberStatus.ACTIVE,
  })
  status: VirtualNumberStatus;

  @Column({
    name: 'quality_rating',
    type: 'enum',
    enum: VirtualNumberQuality,
    default: VirtualNumberQuality.UNKNOWN,
  })
  qualityRating: VirtualNumberQuality;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ name: 'message_count_24h', type: 'int', default: 0 })
  messageCount24h: number;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
