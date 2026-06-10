import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { SpaceshipController } from './spaceship.controller';
import { SpaceshipService } from './spaceship.service';

@Module({
  imports: [AuthModule],
  providers: [SpaceshipService],
  controllers: [SpaceshipController],
})
export class SpaceshipModule {}
