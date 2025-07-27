import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  Auth0JwtStrategy,
  Auth0JwtPayload,
  Auth0User,
} from './auth0-jwt.strategy';
import { Auth0ConfigService } from '../config/auth0-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { User, AuthType } from '@prisma/client';

describe('Auth0JwtStrategy', () => {
  let strategy: Auth0JwtStrategy;
  let auth0ConfigService: jest.Mocked<Auth0ConfigService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockAuth0Config = {
    jwksUri: 'https://test.auth0.com/.well-known/jwks.json',
    audience: 'https://api.example.com',
    issuer: 'https://test.auth0.com/',
    algorithm: 'RS256' as const,
  };

  const mockValidPayload: Auth0JwtPayload = {
    iss: 'https://test.auth0.com/',
    sub: 'auth0|123456789',
    aud: 'https://api.example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    permissions: ['read:users', 'write:users'],
    'https://your-app.com/roles': ['admin', 'user'],
  };

  const mockUser: User = {
    id: 'auth0|123456789',
    email: 'test@example.com',
    name: 'Test User',
    verified: true,
    authType: 'AUTH0' as AuthType,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Auth0JwtStrategy,
        {
          provide: Auth0ConfigService,
          useValue: {
            jwksUri: mockAuth0Config.jwksUri,
            audience: mockAuth0Config.audience,
            issuer: mockAuth0Config.issuer,
            algorithm: mockAuth0Config.algorithm,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    strategy = module.get<Auth0JwtStrategy>(Auth0JwtStrategy);
    auth0ConfigService = module.get(Auth0ConfigService);
    prismaService = module.get(PrismaService);
  });

  describe('validate', () => {
    it('should validate a valid JWT payload and return Auth0User', async () => {
      const result = await strategy.validate(mockValidPayload);

      expect(result).toEqual({
        userId: 'auth0|123456789',
        email: 'test@example.com',
        name: 'Test User',
        permissions: ['read:users', 'write:users'],
        roles: ['admin', 'user'],
        authType: 'AUTH0' as AuthType,
      });
    });

    it('should handle payload with array audience', async () => {
      const payloadWithArrayAudience = {
        ...mockValidPayload,
        aud: ['https://api.example.com', 'https://other-api.com'],
      };

      const result = await strategy.validate(payloadWithArrayAudience);

      expect(result.userId).toBe('auth0|123456789');
      expect(result.permissions).toEqual(['read:users', 'write:users']);
    });

    it('should handle payload without permissions and roles', async () => {
      const payloadWithoutClaims = {
        ...mockValidPayload,
        permissions: undefined,
        'https://your-app.com/roles': undefined,
      };

      const result = await strategy.validate(payloadWithoutClaims);

      expect(result.permissions).toEqual([]);
      expect(result.roles).toEqual([]);
    });

    it('should throw UnauthorizedException for missing subject claim', async () => {
      const invalidPayload = { ...mockValidPayload, sub: undefined };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: missing subject claim'),
      );
    });

    it('should throw UnauthorizedException for missing audience claim', async () => {
      const invalidPayload = { ...mockValidPayload, aud: undefined };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: missing audience claim'),
      );
    });

    it('should throw UnauthorizedException for audience mismatch', async () => {
      const invalidPayload = {
        ...mockValidPayload,
        aud: 'https://wrong-api.com',
      };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: audience mismatch'),
      );
    });

    it('should throw UnauthorizedException for issuer mismatch', async () => {
      const invalidPayload = {
        ...mockValidPayload,
        iss: 'https://wrong-issuer.com/',
      };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: issuer mismatch'),
      );
    });

    it('should handle empty permissions and roles arrays', async () => {
      const payloadWithEmptyArrays = {
        ...mockValidPayload,
        permissions: [],
        'https://your-app.com/roles': [],
      };

      const result = await strategy.validate(payloadWithEmptyArrays);

      expect(result.permissions).toEqual([]);
      expect(result.roles).toEqual([]);
    });
  });

  describe('syncUserWithDatabase', () => {
    it('should create new user if user does not exist', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      const auth0User: Auth0User = {
        userId: 'auth0|123456789',
        email: 'test@example.com',
        name: 'Test User',
        permissions: ['read:users'],
        roles: ['user'],
        authType: 'AUTH0' as AuthType,
      };

      const result = await strategy.syncUserWithDatabase(auth0User);

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'auth0|123456789' }, { email: 'test@example.com' }],
        },
      });

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          id: 'auth0|123456789',
          email: 'test@example.com',
          name: 'Test User',
          verified: true,
          authType: 'AUTH0' as AuthType,
        },
      });

      expect(result).toEqual(mockUser);
    });

    it('should update existing user if auth type is different', async () => {
      const existingUser = { ...mockUser, authType: AuthType.GOOGLE };
      prismaService.user.findFirst.mockResolvedValue(existingUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const auth0User: Auth0User = {
        userId: 'auth0|123456789',
        email: 'test@example.com',
        name: 'Updated Name',
        permissions: ['read:users'],
        roles: ['user'],
        authType: 'AUTH0' as AuthType,
      };

      const result = await strategy.syncUserWithDatabase(auth0User);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'auth0|123456789' },
        data: {
          authType: 'AUTH0' as AuthType,
          verified: true,
          name: 'Updated Name',
        },
      });

      expect(result).toEqual(mockUser);
    });

    it('should return existing user if auth type is already AUTH0', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const auth0User: Auth0User = {
        userId: 'auth0|123456789',
        email: 'test@example.com',
        name: 'Test User',
        permissions: ['read:users'],
        roles: ['user'],
        authType: 'AUTH0' as AuthType,
      };

      const result = await strategy.syncUserWithDatabase(auth0User);

      expect(prismaService.user.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should handle database errors gracefully', async () => {
      prismaService.user.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      const auth0User: Auth0User = {
        userId: 'auth0|123456789',
        email: 'test@example.com',
        name: 'Test User',
        permissions: ['read:users'],
        roles: ['user'],
        authType: 'AUTH0' as AuthType,
      };

      const result = await strategy.syncUserWithDatabase(auth0User);

      expect(result).toBeNull();
    });

    it('should handle user with missing email', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      const auth0User: Auth0User = {
        userId: 'auth0|123456789',
        email: undefined,
        name: 'Test User',
        permissions: ['read:users'],
        roles: ['user'],
        authType: 'AUTH0' as AuthType,
      };

      const result = await strategy.syncUserWithDatabase(auth0User);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          id: 'auth0|123456789',
          email: '',
          name: 'Test User',
          verified: true,
          authType: 'AUTH0' as AuthType,
        },
      });

      expect(result).toEqual(mockUser);
    });
  });

  describe('strategy initialization', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should have correct strategy name', () => {
      expect(strategy.name).toBe('auth0-jwt');
    });
  });
});
