import { Controller } from '@nestjs/common';
import { Crud, CrudController } from '@nestjsx/crud';
import { Spaceship } from './spaceship.entity';
import { SpaceshipService } from './spaceship.service';

@Crud({
  model: {
    type: Spaceship,
  },
})
@Controller('spaceship')
export class SpaceshipController implements CrudController<Spaceship> {
  constructor(public readonly service: SpaceshipService) {}
}
