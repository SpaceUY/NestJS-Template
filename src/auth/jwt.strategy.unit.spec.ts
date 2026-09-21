import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Exceptions } from '../common/exception/exceptions';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { User } from '../database/entities/user.entity';
import { AuthType } from '../database/entities/auth-type.enum';
import { AuthTokenPayload } from './core/auth-token/auth-token.service';
import { jwtScope } from './config/jwt.scope';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockUserRepository = { findOne: jest.fn() };

  const jwtConf = {
    secret: 'a-test-secret',
    expiresIn: '7d',
    ignoreExpiration: false,
  };

  const payload = (
    overrides: Partial<AuthTokenPayload> = {},
  ): AuthTokenPayload => ({
    userId: 'user-uuid',
    authType: AuthType.GOOGLE,
    type: 'auth',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: jwtScope.KEY, useValue: jwtConf },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the user named by the payload', async () => {
    const user = { uuid: 'user-uuid' } as User;
    mockUserRepository.findOne.mockResolvedValue(user);

    await expect(strategy.validate(payload())).resolves.toBe(user);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { uuid: 'user-uuid' },
    });
  });

  it('rejects a token whose user no longer exists', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);

    await expect(strategy.validate(payload())).rejects.toMatchObject({
      errorCode: Exceptions.auth.invalidCredentials.errorCode,
    });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      RequestException,
    );
  });

  // The `type` marker is what keeps a token minted for something else — a
  // password reset, an email verification — from authenticating a request.
  it('refuses a token that is not an auth token, without touching the database', async () => {
    await expect(strategy.validate(payload({ type: 'reset' }))).resolves.toBe(
      null,
    );
    expect(mockUserRepository.findOne).not.toHaveBeenCalled();
  });
});
