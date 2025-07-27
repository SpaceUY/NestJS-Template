import { Test, TestingModule } from '@nestjs/testing';
import { Auth0Service } from './auth0.service';
import { Auth0ConfigService } from '../../config/auth0-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('Auth0Service', () => {
  let service: Auth0Service;
  let configService: Auth0ConfigService;

  const mockConfigService = {
    domain: 'test.auth0.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    audience: 'https://api.test.com',
    logoutUrl: 'http://localhost:3000',
  };

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Auth0Service,
        {
          provide: Auth0ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<Auth0Service>(Auth0Service);
    configService = module.get<Auth0ConfigService>(Auth0ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateLoginUrl', () => {
    it('should generate a valid login URL', async () => {
      const options = {
        redirectUri: 'http://localhost:3000/callback',
        state: 'test-state',
      };

      const result = await service.generateLoginUrl(options);

      expect(result).toContain('https://test.auth0.com/authorize');
      expect(result).toContain('client_id=test-client-id');
      expect(result).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback',
      );
      expect(result).toContain('response_type=code');
      expect(result).toContain(
        'scope=openid%20profile%20email%20offline_access',
      );
      expect(result).toContain('audience=https%3A%2F%2Fapi.test.com');
      expect(result).toContain('state=test-state');
    });

    it('should generate a login URL with default values', async () => {
      const options = {
        redirectUri: 'http://localhost:3000/callback',
      };

      const result = await service.generateLoginUrl(options);

      expect(result).toContain('https://test.auth0.com/authorize');
      expect(result).toContain('response_type=code');
      expect(result).toContain(
        'scope=openid%20profile%20email%20offline_access',
      );
      expect(result).toContain('audience=https%3A%2F%2Fapi.test.com');
      expect(result).toMatch(/state=[a-zA-Z0-9]+/);
    });

    it('should throw error on invalid configuration', async () => {
      jest.spyOn(configService, 'clientId', 'get').mockReturnValue('');

      await expect(
        service.generateLoginUrl({
          redirectUri: 'http://localhost:3000/callback',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('generateLogoutUrl', () => {
    it('should generate a valid logout URL', async () => {
      const result = await service.generateLogoutUrl();

      expect(result).toContain('https://test.auth0.com/v2/logout');
      expect(result).toContain('client_id=test-client-id');
      expect(result).toContain('returnTo=http%3A%2F%2Flocalhost%3A3000');
    });

    it('should generate a logout URL with custom returnTo', async () => {
      const returnTo = 'http://localhost:3000/dashboard';
      const result = await service.generateLogoutUrl(returnTo);

      expect(result).toContain('https://test.auth0.com/v2/logout');
      expect(result).toContain('client_id=test-client-id');
      expect(result).toContain(
        'returnTo=http%3A%2F%2Flocalhost%3A3000%2Fdashboard',
      );
    });
  });

  describe('processCallback', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(
        service.processCallback('test-code', 'http://localhost:3000/callback'),
      ).rejects.toThrow(
        'Token exchange not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('validateToken', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Token validation not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('getUserProfile', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(service.getUserProfile('test-user-id')).rejects.toThrow(
        'User profile retrieval not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(
        service.updateUserProfile('test-user-id', { name: 'Test User' }),
      ).rejects.toThrow(
        'User profile update not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('refreshToken', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(service.refreshToken('test-refresh-token')).rejects.toThrow(
        'Token refresh not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('revokeToken', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(service.revokeToken('test-token')).rejects.toThrow(
        'Token revocation not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('getUserRoles', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(service.getUserRoles('test-user-id')).rejects.toThrow(
        'User roles retrieval not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('getUserPermissions', () => {
    it('should throw error for unimplemented method', async () => {
      await expect(service.getUserPermissions('test-user-id')).rejects.toThrow(
        'User permissions retrieval not yet implemented - requires Auth0 SDK v4 API investigation',
      );
    });
  });

  describe('syncUserProfile', () => {
    const mockAuth0User = {
      user_id: 'auth0|123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      nickname: 'testuser',
      picture: 'https://example.com/avatar.jpg',
      given_name: 'Test',
      family_name: 'User',
      updated_at: '2024-01-01T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
    };

    it('should create new user when user does not exist', async () => {
      const mockNewUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
        authType: 'AUTH0',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockNewUser);

      const result = await service.syncUserProfile(mockAuth0User);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          verified: true,
          authType: 'AUTH0',
        },
      });
      expect(result).toEqual(mockNewUser);
    });

    it('should update existing user when user exists', async () => {
      const mockExistingUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Old Name',
        verified: false,
        authType: 'GOOGLE',
      };

      const mockUpdatedUser = {
        ...mockExistingUser,
        name: 'Test User',
        verified: true,
        authType: 'AUTH0',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockExistingUser);
      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.syncUserProfile(mockAuth0User);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          name: 'Test User',
          verified: true,
          authType: 'AUTH0',
        },
      });
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should use nickname when name is not available', async () => {
      const auth0UserWithoutName = {
        ...mockAuth0User,
        name: undefined,
      };

      const mockNewUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'testuser',
        verified: true,
        authType: 'AUTH0',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockNewUser);

      await service.syncUserProfile(auth0UserWithoutName);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'testuser',
          verified: true,
          authType: 'AUTH0',
        },
      });
    });

    it('should use email when neither name nor nickname is available', async () => {
      const auth0UserWithoutNameOrNickname = {
        ...mockAuth0User,
        name: undefined,
        nickname: undefined,
      };

      const mockNewUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'test@example.com',
        verified: true,
        authType: 'AUTH0',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockNewUser);

      await service.syncUserProfile(auth0UserWithoutNameOrNickname);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'test@example.com',
          verified: true,
          authType: 'AUTH0',
        },
      });
    });

    it('should handle database errors', async () => {
      mockPrismaService.user.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.syncUserProfile(mockAuth0User)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
