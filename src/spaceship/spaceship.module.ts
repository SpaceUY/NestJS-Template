import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { SpaceshipController } from './spaceship.controller';
import { SpaceshipRepository } from './spaceship.repository';
import { SpaceshipService } from './spaceship.service';
import { SpaceshipNotificationQueueModule } from '../queues/notification/notification.module';

@Module({
  imports: [AuthModule, SpaceshipNotificationQueueModule],
  providers: [SpaceshipService, SpaceshipRepository],
  controllers: [SpaceshipController],
})
export class SpaceshipModule {}
