import { Module } from '@nestjs/common';
import { QueueAbstractModule } from './abstract/queue-abstract.module';

@Module({
  imports: [QueueAbstractModule.forRoot()],
})
export class QueuesModule {}
