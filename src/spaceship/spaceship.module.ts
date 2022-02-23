import { Module } from '@nestjs/common';
import { SpaceshipService } from './spaceship.service';
import { SpaceshipController } from './spaceship.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Spaceship } from './spaceship.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Spaceship])],
  providers: [SpaceshipService],
  controllers: [SpaceshipController],
})
export class SpaceshipModule {}
