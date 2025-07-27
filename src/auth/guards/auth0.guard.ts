import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Auth0JwtGuard } from './auth0-jwt.guard';

@Injectable()
export class Auth0Guard implements CanActivate {
  private readonly logger = new Logger(Auth0Guard.name);
  private readonly auth0JwtGuard: Auth0JwtGuard;

  constructor(private reflector: Reflector) {
    this.auth0JwtGuard = new Auth0JwtGuard();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, perform authentication
    const isAuthenticated = await this.auth0JwtGuard.canActivate(context);

    if (!isAuthenticated) {
      throw new UnauthorizedException('Authentication failed');
    }

    // Then, check permissions if specified
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const request = context.switchToHttp().getRequest();
      const user = request.user;

      if (!user) {
        throw new ForbiddenException('User not authenticated');
      }

      const userPermissions = user.permissions || [];

      this.logger.debug(
        `Checking permissions for user ${user.userId}: required=${requiredPermissions.join(
          ', ',
        )}, user=${userPermissions.join(', ')}`,
      );

      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
        this.logger.warn(
          `User ${user.userId} lacks required permissions: ${requiredPermissions.join(
            ', ',
          )}`,
        );
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    // Finally, check roles if specified
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (requiredRoles && requiredRoles.length > 0) {
      const request = context.switchToHttp().getRequest();
      const user = request.user;

      const userRoles = user.roles || [];

      this.logger.debug(
        `Checking roles for user ${user.userId}: required=${requiredRoles.join(
          ', ',
        )}, user=${userRoles.join(', ')}`,
      );

      const hasRequiredRole = requiredRoles.some((role) =>
        userRoles.includes(role),
      );

      if (!hasRequiredRole) {
        this.logger.warn(
          `User ${user.userId} lacks required roles: ${requiredRoles.join(', ')}`,
        );
        throw new ForbiddenException(
          `Insufficient roles. Required: ${requiredRoles.join(', ')}`,
        );
      }
    }

    return true;
  }
}
