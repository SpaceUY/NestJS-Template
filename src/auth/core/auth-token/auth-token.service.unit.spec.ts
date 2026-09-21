import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenService, AuthTokenPayload } from './auth-token.service';
import { AuthTokenModule } from './auth-token.module';
import { jwtScope, JwtScopeConfig } from '../../config/jwt.scope';
import { User } from '../../../database/entities/user.entity';
import { AuthType } from '../../../database/entities/auth-type.enum';

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const user = { uuid: 'user-uuid', email: 'astro@example.com' } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthTokenService,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthTokenService>(AuthTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAuthToken', () => {
    it('signs the user uuid, the auth type and the fixed auth marker', async () => {
      mockJwtService.signAsync.mockResolvedValue('signed-token');

      await expect(
        service.generateAuthToken(user, AuthType.GOOGLE),
      ).resolves.toBe('signed-token');

      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        userId: 'user-uuid',
        authType: AuthType.GOOGLE,
        type: 'auth',
      });
    });

    it('never puts the email or any other user column in the payload', async () => {
      mockJwtService.signAsync.mockResolvedValue('signed-token');

      await service.generateAuthToken(user, AuthType.EMAIL);

      const [payload] = mockJwtService.signAsync.mock.calls[0] as [
        AuthTokenPayload,
      ];
      expect(Object.keys(payload).sort()).toEqual([
        'authType',
        'type',
        'userId',
      ]);
    });
  });

  describe('validateAuthToken', () => {
    it('returns the verified payload', async () => {
      const payload: AuthTokenPayload = {
        userId: 'user-uuid',
        authType: AuthType.GOOGLE,
        type: 'auth',
      };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await expect(service.validateAuthToken('a-token')).resolves.toEqual(
        payload,
      );
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('a-token');
    });

    it('propagates the verification failure instead of swallowing it', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.validateAuthToken('a-token')).rejects.toThrow(
        'jwt expired',
      );
    });
  });

  // AuthTokenModule builds the JwtModule options from `jwtScope`. Signing a
  // real token is the only honest way to prove `expiresIn` is applied — or
  // dropped — without reaching into JwtService's internals.
  describe('signed through AuthTokenModule', () => {
    const boot = async (
      jwtConf: JwtScopeConfig,
    ): Promise<{ service: AuthTokenService; close: () => Promise<void> }> => {
      @Global()
      @Module({
        providers: [{ provide: jwtScope.KEY, useValue: jwtConf }],
        exports: [jwtScope.KEY],
      })
      class ConfigStubModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigStubModule, AuthTokenModule],
      }).compile();

      return {
        service: module.get<AuthTokenService>(AuthTokenService),
        close: () => module.close(),
      };
    };

    const claims = (token: string): Record<string, unknown> =>
      JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      ) as Record<string, unknown>;

    it('applies expiresIn by default', async () => {
      const { service, close } = await boot({
        secret: 'a-test-secret',
        expiresIn: '7d',
        ignoreExpiration: false,
      });

      const token = await service.generateAuthToken(user, AuthType.GOOGLE);

      expect(claims(token)).toHaveProperty('exp');
      await close();
    });

    it('omits expiresIn when the scope says to ignore expiration', async () => {
      const { service, close } = await boot({
        secret: 'a-test-secret',
        expiresIn: '7d',
        ignoreExpiration: true,
      });

      const token = await service.generateAuthToken(user, AuthType.GOOGLE);

      expect(claims(token)).not.toHaveProperty('exp');
      await close();
    });
  });
});
