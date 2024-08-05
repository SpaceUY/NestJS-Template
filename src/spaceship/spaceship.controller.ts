import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../user/current-user.decorator';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';
import { SpaceshipService } from './spaceship.service';

@ApiTags('spaceships')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('spaceships')
export class SpaceshipController {
  constructor(private readonly service: SpaceshipService) {}

  @Post()
  async createSpaceship(
    @Body() data: CreateSpaceshipDto,
    @CurrentUser() user: User,
  ) {
    return this.service.createSpaceship(data, user.id);
  }

  @Get()
  async getAllSpaceships() {
    return this.service.getAllSpaceships();
  }

  @Get(':id')
  async getSpaceshipById(@Param('id') id: string) {
    return this.service.getSpaceshipById(id);
  }

  @Patch(':id')
  async updateSpaceship(
    @Param('id') id: string,
    @Body() data: UpdateSpaceshipDto,
  ) {
    return this.service.updateSpaceship(id, data);
  }

  @Delete(':id')
  async deleteSpaceship(@Param('id') id: string) {
    return this.service.deleteSpaceship(id);
  }
}
