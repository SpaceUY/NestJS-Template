import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { RequestException } from '../../common/exception/core/ExceptionBase';
import { Exceptions } from '../../common/exception/exceptions';
import { User } from '../../database/entities/user.entity';
import { AuthType } from '../../database/entities/auth-type.enum';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { googleScope } from './config/google.scope';
import { GoogleService } from './google.service';

describe('GoogleService', () => {
  let service: GoogleService;

  const mockOauthClient = { verifyIdToken: jest.fn() };
  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockAuthTokenService = { generateAuthToken: jest.fn() };

  const googleConf = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    callbackUrl: 'https://api.example.com/auth/google/callback',
    audience: 'audience-id',
  };

  const ID_TOKEN = 'a-google-id-token';

  /** Makes `verifyIdToken` resolve to a ticket carrying `payload`. */
  const mockTicket = (payload: unknown): void => {
    mockOauthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => payload,
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleService,
        { provide: OAuth2Client, useValue: mockOauthClient },
        { provide: googleScope.KEY, useValue: googleConf },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: AuthTokenService, useValue: mockAuthTokenService },
      ],
    }).compile();

    service = module.get<GoogleService>(GoogleService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates the user and returns an auth token', async () => {
      mockTicket({ name: 'Astro Naut', email: 'astro@example.com' });
      mockUserRepository.findOne.mockResolvedValue(null);
      const created = { uuid: 'new-uuid' } as User;
      mockUserRepository.create.mockReturnValue(created);
      mockUserRepository.save.mockResolvedValue(created);
      mockAuthTokenService.generateAuthToken.mockResolvedValue('auth-token');

      await expect(service.register(ID_TOKEN)).resolves.toBe('auth-token');

      expect(mockOauthClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: ID_TOKEN,
        audience: [googleConf.audience, googleConf.clientId],
      });
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'astro@example.com',
        name: 'Astro Naut',
        authType: AuthType.GOOGLE,
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(created);
      expect(mockAuthTokenService.generateAuthToken).toHaveBeenCalledWith(
        created,
        AuthType.GOOGLE,
      );
    });

    it('rejects a ticket with no payload', async () => {
      mockTicket(undefined);

      await expect(service.register(ID_TOKEN)).rejects.toMatchObject({
        errorCode: Exceptions.auth.invalidPayload.errorCode,
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an email that already has an account', async () => {
      mockTicket({ name: 'Astro Naut', email: 'astro@example.com' });
      mockUserRepository.findOne.mockResolvedValue({ uuid: 'existing' });

      await expect(service.register(ID_TOKEN)).rejects.toMatchObject({
        errorCode: Exceptions.auth.alreadyExists.errorCode,
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('answers invalid credentials when the provider rejects the token', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      mockOauthClient.verifyIdToken.mockRejectedValue(new Error('boom'));

      await expect(service.register(ID_TOKEN)).rejects.toMatchObject({
        errorCode: Exceptions.auth.invalidCredentials.errorCode,
      });
    });
  });

  describe('login', () => {
    it('returns an auth token for an existing Google user', async () => {
      mockTicket({ email: 'astro@example.com' });
      const existing = { uuid: 'uuid', authType: AuthType.GOOGLE } as User;
      mockUserRepository.findOne.mockResolvedValue(existing);
      mockAuthTokenService.generateAuthToken.mockResolvedValue('auth-token');

      await expect(service.login(ID_TOKEN)).resolves.toBe('auth-token');
      expect(mockAuthTokenService.generateAuthToken).toHaveBeenCalledWith(
        existing,
        AuthType.GOOGLE,
      );
    });

    it('rejects an unknown email', async () => {
      mockTicket({ email: 'astro@example.com' });
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(ID_TOKEN)).rejects.toMatchObject({
        errorCode: Exceptions.auth.invalidCredentials.errorCode,
      });
    });

    it('refuses to log in an account created through another auth type', async () => {
      mockTicket({ email: 'astro@example.com' });
      mockUserRepository.findOne.mockResolvedValue({
        uuid: 'uuid',
        authType: AuthType.EMAIL,
      });

      await expect(service.login(ID_TOKEN)).rejects.toMatchObject({
        errorCode: Exceptions.auth.invalidCredentials.errorCode,
      });
      expect(mockAuthTokenService.generateAuthToken).not.toHaveBeenCalled();
    });

    it('rejects a ticket with no payload', async () => {
      mockTicket(undefined);

      await expect(service.login(ID_TOKEN)).rejects.toMatchObject({
        errorCode: Exceptions.auth.invalidPayload.errorCode,
      });
    });
  });

  // Finding `C5`: a rejected verifyIdToken carries the submitted ID token in
  // its message, so the error object must never reach the log.
  describe('provider failure logging', () => {
    it.each([
      ['register', (s: GoogleService) => s.register(ID_TOKEN)],
      ['login', (s: GoogleService) => s.login(ID_TOKEN)],
    ])('logs only the error kind on %s, never the token', async (_, call) => {
      const error = new Error(
        `Wrong recipient, payload audience = ${ID_TOKEN}`,
      );
      const logged: string[] = [];
      jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation((message: unknown) => {
          logged.push(String(message));
        });
      mockOauthClient.verifyIdToken.mockRejectedValue(error);

      await expect(call(service)).rejects.toBeInstanceOf(RequestException);

      expect(logged).toHaveLength(1);
      expect(logged[0]).not.toContain(ID_TOKEN);
      expect(logged[0]).not.toContain(error.message);
      expect(logged[0]).toContain('Error');
    });

    it('does not log an application-level rejection as a provider failure', async () => {
      const spy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      mockTicket({ email: 'astro@example.com' });
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(ID_TOKEN)).rejects.toBeInstanceOf(
        RequestException,
      );

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
