import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualNumber } from './entities/virtual-number.entity';
import { BusinessNumber } from './entities/business-number.entity';
import { NumbersService } from './numbers.service';
import { NumbersController } from './numbers.controller';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VirtualNumber, BusinessNumber])],
  controllers: [NumbersController, WebhooksController],
  providers: [NumbersService],
  exports: [NumbersService],
})
export class NumbersModule {}
