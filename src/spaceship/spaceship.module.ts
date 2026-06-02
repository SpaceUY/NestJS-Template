import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Spaceship } from './spaceship.entity';
import { SpaceshipController } from './spaceship.controller';
import { SpaceshipService } from './spaceship.service';

@Module({
  imports: [TypeOrmModule.forFeature([Spaceship]), AuthModule],
  providers: [SpaceshipService],
  controllers: [SpaceshipController],
})
export class SpaceshipModule {}
