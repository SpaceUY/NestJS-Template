import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required roles for a route
 * @param roles - Array of required roles
 * @example
 * @UseGuards(Auth0JwtGuard, RolesGuard)
 * @Roles('admin', 'moderator')
 * getAdminData() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
