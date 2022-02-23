import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import { Repository } from 'typeorm';
import { Spaceship } from './spaceship.entity';

@Injectable()
export class SpaceshipService extends TypeOrmCrudService<Spaceship> {
  constructor(
    @InjectRepository(Spaceship) spaceshipRepo: Repository<Spaceship>,
  ) {
    super(spaceshipRepo);
  }
}
