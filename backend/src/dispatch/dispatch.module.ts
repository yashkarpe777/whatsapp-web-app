import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { NumbersModule } from '../numbers/numbers.module';

@Module({
  imports: [NumbersModule],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
