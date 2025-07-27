import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UserSyncService, SyncResult, SyncOptions } from './user-sync.service';
import { Auth0Service, Auth0UserProfile } from '../auth0/auth0.service';
import { PrismaService } from '../../prisma/prisma.service';
import { User, AuthType } from '@prisma/client';

describe('UserSyncService', () => {
  let service: UserSyncService;
  let auth0Service: jest.Mocked<Auth0Service>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockAuth0Profile: Auth0UserProfile = {
    user_id: 'auth0|123456789',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    nickname: 'testuser',
    picture: 'https://example.com/avatar.jpg',
    given_name: 'Test',
    family_name: 'User',
    updated_at: '2023-01-01T00:00:00.000Z',
    created_at: '2023-01-01T00:00:00.000Z',
  };

  const mockUser: User = {
    id: 'local-uuid-123',
    auth0Id: 'auth0|123456789',
    email: 'test@example.com',
    name: 'Test User',
    verified: true,
    authType: AuthType.AUTH0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    picture: 'https://example.com/avatar.jpg',
    nickname: 'testuser',
    emailVerified: true,
    userMetadata: {
      given_name: 'Test',
      family_name: 'User',
      updated_at: '2023-01-01T00:00:00.000Z',
      created_at: '2023-01-01T00:00:00.000Z',
    },
    appMetadata: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSyncService,
        {
          provide: Auth0Service,
          useValue: {
            getUserProfile: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserSyncService>(UserSyncService);
    auth0Service = module.get(Auth0Service);
    prismaService = module.get(PrismaService);
  });

  describe('syncUserByAuth0Id', () => {
    it('should sync user successfully when user exists', async () => {
      auth0Service.getUserProfile.mockResolvedValue(mockAuth0Profile);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.syncUserByAuth0Id('auth0|123456789');

      expect(auth0Service.getUserProfile).toHaveBeenCalledWith(
        'auth0|123456789',
      );
      expect(result.user).toEqual(mockUser);
      expect(result.action).toBe('updated');
    });

    it('should create new user when user does not exist', async () => {
      auth0Service.getUserProfile.mockResolvedValue(mockAuth0Profile);
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.syncUserByAuth0Id('auth0|123456789');

      expect(prismaService.user.create).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
      expect(result.action).toBe('created');
    });

    it('should throw error when Auth0 profile fetch fails', async () => {
      auth0Service.getUserProfile.mockRejectedValue(
        new Error('Auth0 API error'),
      );

      await expect(
        service.syncUserByAuth0Id('auth0|123456789'),
      ).rejects.toThrow('Auth0 API error');
    });
  });

  describe('syncUserByEmail', () => {
    it('should sync user by email successfully', async () => {
      const existingUser = { ...mockUser, auth0Id: 'auth0|123456789' };
      prismaService.user.findFirst.mockResolvedValue(existingUser);
      auth0Service.getUserProfile.mockResolvedValue(mockAuth0Profile);
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.syncUserByEmail('test@example.com');

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result.user).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.syncUserByEmail('nonexistent@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user is not Auth0 user', async () => {
      const nonAuth0User = {
        ...mockUser,
        authType: AuthType.GOOGLE,
        auth0Id: null,
      };
      prismaService.user.findFirst.mockResolvedValue(nonAuth0User);

      await expect(service.syncUserByEmail('test@example.com')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('upsertUserFromAuth0Profile', () => {
    it('should create new user when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.upsertUserFromAuth0Profile(mockAuth0Profile);

      expect(prismaService.user.create).toHaveBeenCalled();
      expect(result.action).toBe('created');
    });

    it('should update existing user when changes detected', async () => {
      const updatedProfile = { ...mockAuth0Profile, name: 'Updated Name' };
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      });

      const result = await service.upsertUserFromAuth0Profile(updatedProfile);

      expect(prismaService.user.update).toHaveBeenCalled();
      expect(result.action).toBe('updated');
      expect(result.changes).toBeDefined();
    });

    it('should return no-change when no changes detected', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.upsertUserFromAuth0Profile(mockAuth0Profile);

      expect(result.action).toBe('no-change');
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should force update when forceUpdate option is true', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.upsertUserFromAuth0Profile(
        mockAuth0Profile,
        {
          forceUpdate: true,
        },
      );

      expect(prismaService.user.update).toHaveBeenCalled();
      expect(result.action).toBe('updated');
    });

    it('should handle email conflict with merge strategy', async () => {
      const existingUser = {
        ...mockUser,
        authType: AuthType.GOOGLE,
        auth0Id: null,
      };
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(existingUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.upsertUserFromAuth0Profile(
        mockAuth0Profile,
        {
          handleConflicts: 'merge',
        },
      );

      expect(prismaService.user.update).toHaveBeenCalled();
      expect(result.action).toBe('updated');
    });

    it('should handle email conflict with skip strategy', async () => {
      const existingUser = {
        ...mockUser,
        authType: AuthType.GOOGLE,
        auth0Id: null,
      };
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(existingUser);

      const result = await service.upsertUserFromAuth0Profile(
        mockAuth0Profile,
        {
          handleConflicts: 'skip',
        },
      );

      expect(result.action).toBe('no-change');
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException with error strategy', async () => {
      const existingUser = {
        ...mockUser,
        authType: AuthType.GOOGLE,
        auth0Id: null,
      };
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(
        service.upsertUserFromAuth0Profile(mockAuth0Profile, {
          handleConflicts: 'error',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('batchSyncUsers', () => {
    it('should sync multiple users successfully', async () => {
      const auth0Ids = ['auth0|123', 'auth0|456'];
      auth0Service.getUserProfile.mockResolvedValue(mockAuth0Profile);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const results = await service.batchSyncUsers(auth0Ids);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('updated');
      expect(results[1].action).toBe('updated');
    });

    it('should handle errors in batch sync', async () => {
      const auth0Ids = ['auth0|123', 'auth0|456'];
      auth0Service.getUserProfile
        .mockResolvedValueOnce(mockAuth0Profile)
        .mockRejectedValueOnce(new Error('Auth0 error'));

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const results = await service.batchSyncUsers(auth0Ids);

      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('updated');
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status for existing user', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const status = await service.getSyncStatus('auth0|123456789');

      expect(status.synced).toBe(true);
      expect(status.user).toEqual(mockUser);
      expect(status.lastSync).toEqual(mockUser.updatedAt);
    });

    it('should return not synced for non-existing user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const status = await service.getSyncStatus('auth0|nonexistent');

      expect(status.synced).toBe(false);
      expect(status.user).toBeUndefined();
    });
  });

  describe('cleanupOrphanedUsers', () => {
    it('should clean up orphaned users', async () => {
      const auth0Users = [
        { ...mockUser, id: 'user1' },
        { ...mockUser, id: 'user2' },
      ];

      prismaService.user.findMany.mockResolvedValue(auth0Users);
      auth0Service.getUserProfile
        .mockResolvedValueOnce(mockAuth0Profile) // User 1 exists in Auth0
        .mockRejectedValueOnce(new NotFoundException('User not found')); // User 2 doesn't exist

      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.cleanupOrphanedUsers();

      expect(result.total).toBe(2);
      expect(result.cleaned).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user2' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getSyncStatus('auth0|123')).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle Auth0 API errors', async () => {
      auth0Service.getUserProfile.mockRejectedValue(
        new Error('Auth0 API error'),
      );

      await expect(service.syncUserByAuth0Id('auth0|123')).rejects.toThrow(
        'Auth0 API error',
      );
    });
  });
});
