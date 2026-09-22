import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpaceshipController } from './spaceship.controller';
import { SpaceshipRepository } from './spaceship.repository';
import { SpaceshipService } from './spaceship.service';
import { SpaceshipNotificationQueueModule } from './notification/notification.module';

@Module({
  imports: [AuthModule, SpaceshipNotificationQueueModule],
  providers: [SpaceshipService, SpaceshipRepository],
  controllers: [SpaceshipController],
})
export class SpaceshipModule {}
