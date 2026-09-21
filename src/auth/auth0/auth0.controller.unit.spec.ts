import { Test, TestingModule } from '@nestjs/testing';
import { Auth0Controller } from './auth0.controller';
import { Auth0Service } from './auth0.service';

describe('Auth0Controller', () => {
  let controller: Auth0Controller;

  const mockAuth0Service = { login: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Auth0Controller],
      providers: [{ provide: Auth0Service, useValue: mockAuth0Service }],
    }).compile();

    controller = module.get<Auth0Controller>(Auth0Controller);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('passes the access token to the service and returns its token', async () => {
    mockAuth0Service.login.mockResolvedValue('auth-token');

    await expect(
      controller.login({ accessToken: 'provider-access-token' }),
    ).resolves.toBe('auth-token');
    expect(mockAuth0Service.login).toHaveBeenCalledWith(
      'provider-access-token',
    );
  });

  it('does not translate a service rejection', async () => {
    const error = new Error('denied');
    mockAuth0Service.login.mockRejectedValue(error);

    await expect(
      controller.login({ accessToken: 'provider-access-token' }),
    ).rejects.toBe(error);
  });
});
