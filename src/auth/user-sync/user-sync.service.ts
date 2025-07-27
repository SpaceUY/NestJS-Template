import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Auth0Service, Auth0UserProfile } from '../auth0/auth0.service';
import { User, AuthType } from '@prisma/client';

export interface SyncResult {
  user: User;
  action: 'created' | 'updated' | 'no-change';
  changes?: Record<string, any>;
}

export interface SyncOptions {
  forceUpdate?: boolean;
  createIfNotExists?: boolean;
  handleConflicts?: 'merge' | 'skip' | 'error';
}

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth0Service: Auth0Service,
  ) {}

  /**
   * Synchronize user profile by Auth0 ID
   */
  async syncUserByAuth0Id(
    auth0Id: string,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    try {
      this.logger.log(`Starting sync for Auth0 user: ${auth0Id}`);

      // Fetch user profile from Auth0
      const auth0Profile = await this.auth0Service.getUserProfile(auth0Id);

      // Sync with local database
      const result = await this.upsertUserFromAuth0Profile(
        auth0Profile,
        options,
      );

      this.logger.log(
        `Sync completed for Auth0 user: ${auth0Id} - Action: ${result.action}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to sync Auth0 user ${auth0Id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Synchronize user profile by email
   */
  async syncUserByEmail(
    email: string,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    try {
      this.logger.log(`Starting sync for user email: ${email}`);

      // Find existing user by email
      const existingUser = await this.prisma.user.findFirst({
        where: { email },
      });

      if (!existingUser) {
        throw new NotFoundException(`User with email ${email} not found`);
      }

      if (existingUser.authType !== AuthType.AUTH0 || !existingUser.auth0Id) {
        throw new ConflictException(
          `User ${email} is not an Auth0 user or missing Auth0 ID`,
        );
      }

      // Sync using Auth0 ID
      return await this.syncUserByAuth0Id(existingUser.auth0Id, options);
    } catch (error) {
      this.logger.error(
        `Failed to sync user by email ${email}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Upsert user from Auth0 profile
   */
  async upsertUserFromAuth0Profile(
    auth0Profile: Auth0UserProfile,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    try {
      const {
        forceUpdate = false,
        createIfNotExists = true,
        handleConflicts = 'error',
      } = options;

      // Check if user exists by Auth0 ID
      let existingUser = await this.prisma.user.findUnique({
        where: { auth0Id: auth0Profile.user_id },
      });

      // If not found by Auth0 ID, check by email
      if (!existingUser) {
        existingUser = await this.prisma.user.findUnique({
          where: { email: auth0Profile.email },
        });

        if (existingUser) {
          // Handle conflict: user exists with same email but different auth type
          return await this.handleEmailConflict(
            existingUser,
            auth0Profile,
            handleConflicts,
          );
        }
      }

      // Map Auth0 profile to Prisma data
      const userData = this.mapAuth0ProfileToPrisma(auth0Profile);

      if (!existingUser) {
        // Create new user
        if (!createIfNotExists) {
          throw new NotFoundException(
            `User not found and createIfNotExists is disabled`,
          );
        }

        const newUser = await this.prisma.user.create({
          data: userData,
        });

        this.logger.log(
          `Created new user: ${newUser.id} for Auth0: ${auth0Profile.user_id}`,
        );

        return {
          user: newUser,
          action: 'created',
          changes: userData,
        };
      }

      // Update existing user
      const changes = this.getChanges(existingUser, userData);

      if (Object.keys(changes).length === 0 && !forceUpdate) {
        this.logger.debug(`No changes detected for user: ${existingUser.id}`);
        return {
          user: existingUser,
          action: 'no-change',
        };
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: userData,
      });

      this.logger.log(
        `Updated user: ${updatedUser.id} for Auth0: ${auth0Profile.user_id}`,
      );

      return {
        user: updatedUser,
        action: 'updated',
        changes,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upsert user from Auth0 profile: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle email conflict when user exists with same email but different auth type
   */
  private async handleEmailConflict(
    existingUser: User,
    auth0Profile: Auth0UserProfile,
    handleConflicts: string,
  ): Promise<SyncResult> {
    this.logger.warn(
      `Email conflict detected: ${auth0Profile.email} exists with auth type: ${existingUser.authType}`,
    );

    switch (handleConflicts) {
      case 'merge':
        // Merge by updating the existing user to Auth0
        const userData = this.mapAuth0ProfileToPrisma(auth0Profile);
        const changes = this.getChanges(existingUser, userData);

        const mergedUser = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: userData,
        });

        this.logger.log(`Merged user: ${mergedUser.id} to Auth0`);

        return {
          user: mergedUser,
          action: 'updated',
          changes,
        };

      case 'skip':
        this.logger.log(`Skipping sync due to email conflict`);
        return {
          user: existingUser,
          action: 'no-change',
        };

      case 'error':
      default:
        throw new ConflictException(
          `User with email ${auth0Profile.email} already exists with auth type: ${existingUser.authType}`,
        );
    }
  }

  /**
   * Map Auth0 profile to Prisma User data
   */
  private mapAuth0ProfileToPrisma(auth0Profile: Auth0UserProfile): any {
    return {
      auth0Id: auth0Profile.user_id,
      email: auth0Profile.email,
      name: auth0Profile.name || auth0Profile.email.split('@')[0], // Fallback to email prefix
      verified: auth0Profile.email_verified,
      authType: 'AUTH0' as AuthType,
      picture: auth0Profile.picture,
      nickname: auth0Profile.nickname,
      emailVerified: auth0Profile.email_verified,
      // Store additional metadata as JSON
      userMetadata: {
        given_name: auth0Profile.given_name,
        family_name: auth0Profile.family_name,
        updated_at: auth0Profile.updated_at,
        created_at: auth0Profile.created_at,
      },
      // app_metadata will be populated separately if needed
      appMetadata: {},
    };
  }

  /**
   * Get changes between existing user and new data
   */
  private getChanges(existingUser: User, newData: any): Record<string, any> {
    const changes: Record<string, any> = {};

    // Compare relevant fields
    const fieldsToCompare = [
      'email',
      'name',
      'verified',
      'picture',
      'nickname',
      'emailVerified',
      'userMetadata',
      'appMetadata',
    ];

    for (const field of fieldsToCompare) {
      if (
        newData[field] !== undefined &&
        existingUser[field] !== newData[field]
      ) {
        changes[field] = {
          from: existingUser[field],
          to: newData[field],
        };
      }
    }

    return changes;
  }

  /**
   * Batch sync multiple users
   */
  async batchSyncUsers(
    auth0Ids: string[],
    options: SyncOptions = {},
  ): Promise<SyncResult[]> {
    this.logger.log(`Starting batch sync for ${auth0Ids.length} users`);

    const results: SyncResult[] = [];
    const errors: Array<{ auth0Id: string; error: string }> = [];

    for (const auth0Id of auth0Ids) {
      try {
        const result = await this.syncUserByAuth0Id(auth0Id, options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to sync user ${auth0Id}: ${error.message}`);
        errors.push({ auth0Id, error: error.message });
      }
    }

    this.logger.log(
      `Batch sync completed: ${results.length} successful, ${errors.length} failed`,
    );

    if (errors.length > 0) {
      this.logger.warn(`Batch sync errors: ${JSON.stringify(errors)}`);
    }

    return results;
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(auth0Id: string): Promise<{
    synced: boolean;
    lastSync?: Date;
    user?: User;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { auth0Id },
      });

      if (!user) {
        return { synced: false };
      }

      return {
        synced: true,
        lastSync: user.updatedAt,
        user,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get sync status for ${auth0Id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Clean up orphaned Auth0 users (users that exist locally but not in Auth0)
   */
  async cleanupOrphanedUsers(): Promise<{
    total: number;
    cleaned: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    this.logger.log('Starting cleanup of orphaned Auth0 users');

    const auth0Users = await this.prisma.user.findMany({
      where: {
        authType: 'AUTH0',
        auth0Id: { not: null },
      },
    });

    let cleaned = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const user of auth0Users) {
      try {
        // Try to fetch user from Auth0
        await this.auth0Service.getUserProfile(user.auth0Id!);
      } catch (error) {
        if (error instanceof NotFoundException) {
          // User doesn't exist in Auth0, mark as deleted
          await this.prisma.user.update({
            where: { id: user.id },
            data: { deletedAt: new Date() },
          });
          cleaned++;
          this.logger.log(`Marked orphaned user as deleted: ${user.id}`);
        } else {
          errors.push({ userId: user.id, error: error.message });
        }
      }
    }

    this.logger.log(
      `Cleanup completed: ${cleaned} users cleaned, ${errors.length} errors`,
    );

    return {
      total: auth0Users.length,
      cleaned,
      errors,
    };
  }
}
