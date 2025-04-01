import { Test, TestingModule } from '@nestjs/testing';
import { BasicAuthController } from './basic-auth.controller';

describe('BasicAuthController', () => {
  let controller: BasicAuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BasicAuthController],
    }).compile();

    controller = module.get<BasicAuthController>(BasicAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
