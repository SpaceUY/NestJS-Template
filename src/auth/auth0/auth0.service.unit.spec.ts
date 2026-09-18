import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestException } from '../../common/exception/core/ExceptionBase';
import { User } from '../../database/entities/user.entity';
import { AuthType } from '../core/auth-type.enum';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { auth0Scope } from './config/auth0.scope';
import { Auth0Service } from './auth0.service';

describe('Auth0Service', () => {
  let service: Auth0Service;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuthTokenService = {
    generateAuthToken: jest.fn(),
  };

  const auth0Conf = {
    enabled: true,
    domain: 'tenant.auth0.com',
    audience: 'https://api.example.com',
    issuer: 'https://tenant.auth0.com/',
    jwksUri: 'https://tenant.auth0.com/.well-known/jwks.json',
  };

  const makeAccessToken = (
    claims: Record<string, unknown> = {
      iss: auth0Conf.issuer,
      aud: auth0Conf.audience,
    },
  ): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString(
      'base64url',
    );
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${header}.${payload}.signature`;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Auth0Service,
        { provide: auth0Scope.KEY, useValue: auth0Conf },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: AuthTokenService, useValue: mockAuthTokenService },
      ],
    }).compile();

    service = module.get<Auth0Service>(Auth0Service);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUserInfo = (body: Record<string, unknown>, ok = true): void => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok,
      json: () => Promise.resolve(body),
    });
  };

  it('provisions a new user on first login', async () => {
    mockUserInfo({
      sub: 'auth0|123',
      email: 'astro@example.com',
      email_verified: true,
      name: 'Astro',
    });
    mockUserRepository.findOne.mockResolvedValue(null);
    const created = { email: 'astro@example.com', name: 'Astro' };
    mockUserRepository.create.mockReturnValue(created);
    mockUserRepository.save.mockResolvedValue(created);
    mockAuthTokenService.generateAuthToken.mockResolvedValue('app-jwt');

    const result = await service.login(makeAccessToken());

    expect(mockUserRepository.create).toHaveBeenCalledWith({
      auth0Id: 'auth0|123',
      email: 'astro@example.com',
      name: 'Astro',
      verified: true,
      authType: AuthType.AUTH0,
    });
    expect(mockAuthTokenService.generateAuthToken).toHaveBeenCalledWith(
      created,
      AuthType.AUTH0,
    );
    expect(result).toBe('app-jwt');
  });

  it('logs an existing user in without rewriting an unchanged profile', async () => {
    mockUserInfo({
      sub: 'auth0|123',
      email: 'astro@example.com',
      email_verified: true,
      name: 'Astro',
    });
    const existingUser = { email: 'astro@example.com', name: 'Astro' } as User;
    mockUserRepository.findOne.mockResolvedValue(existingUser);
    mockAuthTokenService.generateAuthToken.mockResolvedValue('app-jwt');

    const result = await service.login(makeAccessToken());

    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockAuthTokenService.generateAuthToken).toHaveBeenCalledWith(
      existingUser,
      AuthType.AUTH0,
    );
    expect(result).toBe('app-jwt');
  });

  it('syncs the local profile when the Auth0 profile drifted', async () => {
    mockUserInfo({
      sub: 'auth0|123',
      email: 'new@example.com',
      email_verified: true,
      name: 'New Name',
    });
    const existingUser = { email: 'old@example.com', name: 'Old Name' } as User;
    mockUserRepository.findOne.mockResolvedValue(existingUser);
    mockUserRepository.save.mockResolvedValue(existingUser);
    mockAuthTokenService.generateAuthToken.mockResolvedValue('app-jwt');

    await service.login(makeAccessToken());

    expect(mockUserRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', name: 'New Name' }),
    );
  });

  it('rejects an unverified Auth0 email', async () => {
    mockUserInfo({
      sub: 'auth0|123',
      email: 'astro@example.com',
      email_verified: false,
    });

    await expect(service.login(makeAccessToken())).rejects.toBeInstanceOf(
      RequestException,
    );
    expect(mockUserRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects when the Auth0 /userinfo call fails', async () => {
    mockUserInfo({}, false);

    await expect(service.login(makeAccessToken())).rejects.toBeInstanceOf(
      RequestException,
    );
  });

  it('rejects a token minted for a different Auth0 application (wrong audience)', async () => {
    mockUserInfo({
      sub: 'auth0|123',
      email: 'astro@example.com',
      email_verified: true,
    });

    const otherAppToken = makeAccessToken({
      iss: auth0Conf.issuer,
      aud: 'https://some-other-app.example.com',
    });

    await expect(service.login(otherAppToken)).rejects.toBeInstanceOf(
      RequestException,
    );
    expect(mockUserRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a token from a different Auth0 tenant (wrong issuer)', async () => {
    mockUserInfo({
      sub: 'auth0|123',
      email: 'astro@example.com',
      email_verified: true,
    });

    const otherTenantToken = makeAccessToken({
      iss: 'https://other-tenant.auth0.com/',
      aud: auth0Conf.audience,
    });

    await expect(service.login(otherTenantToken)).rejects.toBeInstanceOf(
      RequestException,
    );
  });

  it('rejects a malformed access token', async () => {
    mockUserInfo({
      sub: 'auth0|123',
      email: 'astro@example.com',
      email_verified: true,
    });

    await expect(service.login('not-a-jwt')).rejects.toBeInstanceOf(
      RequestException,
    );
  });
});
