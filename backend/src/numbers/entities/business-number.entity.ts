import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VirtualNumber } from './virtual-number.entity';

@Entity('business_numbers')
export class BusinessNumber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'business_name', length: 128, nullable: true })
  businessName?: string | null;

  @Column({ name: 'waba_id', length: 64 })
  wabaId: string;

  @Column({ name: 'phone_number_id', length: 64, unique: true })
  phoneNumberId: string;

  @Column({ name: 'display_phone_number', length: 32, nullable: true })
  displayPhoneNumber?: string | null;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'auto_switch_enabled', default: true })
  autoSwitchEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => VirtualNumber, (virtual) => virtual.businessNumber)
  virtualNumbers?: VirtualNumber[];
}
