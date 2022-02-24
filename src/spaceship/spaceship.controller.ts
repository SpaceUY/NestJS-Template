import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Crud, CrudController } from '@nestjsx/crud';
import { Spaceship } from './spaceship.entity';
import { SpaceshipService } from './spaceship.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Crud({
  model: {
    type: Spaceship,
  },
  routes: {
    exclude: ['getOneBase'],
    getManyBase: {
      decorators: [ApiBearerAuth(), UseGuards(AuthGuard('jwt'))],
    },
  },
})
@ApiTags('spaceship')
@Controller('spaceship')
export class SpaceshipController implements CrudController<Spaceship> {
  constructor(public readonly service: SpaceshipService) {}
}
