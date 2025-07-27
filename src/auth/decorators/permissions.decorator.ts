import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required permissions for a route
 * @param permissions - Array of required permissions
 * @example
 * @UseGuards(Auth0JwtGuard, PermissionsGuard)
 * @Permissions('read:users', 'write:users')
 * getUsers() { ... }
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
