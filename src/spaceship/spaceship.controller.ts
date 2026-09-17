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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '../database/entities/user.entity';
import { CurrentUser } from '../user/current-user.decorator';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { SpaceshipResponseDto } from './dto/spaceship-response.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';
import { SpaceshipMapper } from './mappers/spaceship.mapper';
import { SpaceshipService } from './spaceship.service';

@ApiTags('spaceships')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('spaceships')
export class SpaceshipController {
  constructor(private readonly service: SpaceshipService) {}

  @Post()
  @ApiOperation({ summary: 'Create a spaceship' })
  @ApiResponse({ status: 201, type: SpaceshipResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async createSpaceship(
    @Body() data: CreateSpaceshipDto,
    @CurrentUser() user: User,
  ): Promise<SpaceshipResponseDto> {
    const spaceship = await this.service.createSpaceship(data, user.id);
    return SpaceshipMapper.toResponse(spaceship);
  }

  @Get()
  @ApiOperation({ summary: 'List spaceships' })
  @ApiResponse({ status: 200, type: [SpaceshipResponseDto] })
  async getAllSpaceships(): Promise<SpaceshipResponseDto[]> {
    const spaceships = await this.service.getAllSpaceships();
    return SpaceshipMapper.toResponseList(spaceships);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Spaceship public uuid' })
  @ApiOperation({ summary: 'Get a spaceship by id' })
  @ApiResponse({ status: 200, type: SpaceshipResponseDto })
  @ApiResponse({ status: 404, description: 'Spaceship not found' })
  async getSpaceshipById(
    @Param('id') id: string,
  ): Promise<SpaceshipResponseDto> {
    const spaceship = await this.service.getSpaceshipById(id);
    return SpaceshipMapper.toResponse(spaceship);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Spaceship public uuid' })
  @ApiOperation({ summary: 'Update a spaceship' })
  @ApiResponse({ status: 200, type: SpaceshipResponseDto })
  @ApiResponse({ status: 404, description: 'Spaceship not found' })
  async updateSpaceship(
    @Param('id') id: string,
    @Body() data: UpdateSpaceshipDto,
  ): Promise<SpaceshipResponseDto> {
    const spaceship = await this.service.updateSpaceship(id, data);
    return SpaceshipMapper.toResponse(spaceship);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Spaceship public uuid' })
  @ApiOperation({ summary: 'Delete a spaceship' })
  @ApiResponse({ status: 200, type: SpaceshipResponseDto })
  @ApiResponse({ status: 404, description: 'Spaceship not found' })
  async deleteSpaceship(
    @Param('id') id: string,
  ): Promise<SpaceshipResponseDto> {
    const spaceship = await this.service.deleteSpaceship(id);
    return SpaceshipMapper.toResponse(spaceship);
  }
}
