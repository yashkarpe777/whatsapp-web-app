import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' }) 
  user: User;

  @Column()
  campaign_name: string;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ type: 'text', nullable: true })
  media_url: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  media_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  media_name: string;

  @Column({ default: 'draft' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduled_start: Date;

  @Column({ type: 'timestamp', nullable: true })
  scheduled_end: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}