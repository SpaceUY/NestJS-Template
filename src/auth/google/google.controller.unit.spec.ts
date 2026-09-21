import { Test, TestingModule } from '@nestjs/testing';
import { AuthType } from '../../database/entities/auth-type.enum';
import { User } from '../../database/entities/user.entity';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { googleScope } from './config/google.scope';

describe('GoogleController', () => {
  let controller: GoogleController;

  const mockAuthTokenService = { generateAuthToken: jest.fn() };
  const mockGoogleService = { register: jest.fn(), login: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleController],
      providers: [
        { provide: AuthTokenService, useValue: mockAuthTokenService },
        { provide: GoogleService, useValue: mockGoogleService },
        // The controller carries `GoogleEnabledGuard`, which reads the scope.
        // Enabled here: the disabled path is `google-enabled.guard.unit.spec.ts`.
        { provide: googleScope.KEY, useValue: { enabled: true } },
      ],
    }).compile();

    controller = module.get<GoogleController>(GoogleController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('mints a token for the user the web callback guard resolved', async () => {
    const user = { uuid: 'uuid' } as User;
    mockAuthTokenService.generateAuthToken.mockResolvedValue('auth-token');

    await expect(controller.webCallback(user)).resolves.toBe('auth-token');
    expect(mockAuthTokenService.generateAuthToken).toHaveBeenCalledWith(
      user,
      AuthType.GOOGLE,
    );
  });

  it('passes the mobile register id token straight to the service', async () => {
    mockGoogleService.register.mockResolvedValue('auth-token');

    await expect(
      controller.mobileRegister({ idToken: 'id-token' }),
    ).resolves.toBe('auth-token');
    expect(mockGoogleService.register).toHaveBeenCalledWith('id-token');
  });

  it('passes the mobile login id token straight to the service', async () => {
    mockGoogleService.login.mockResolvedValue('auth-token');

    await expect(controller.mobileLogin({ idToken: 'id-token' })).resolves.toBe(
      'auth-token',
    );
    expect(mockGoogleService.login).toHaveBeenCalledWith('id-token');
  });

  // The redirect entry point is the guard's job; the handler itself is empty
  // on purpose and must stay that way.
  it('leaves the web entry point to the passport guard', () => {
    expect(controller.web()).toBeUndefined();
  });
});
