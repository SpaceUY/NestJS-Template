import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('No user found in request for permissions check');
      throw new ForbiddenException('User not authenticated');
    }

    const userPermissions = user.permissions || [];

    this.logger.debug(
      `Checking permissions for user ${user.userId}: required=${requiredPermissions.join(', ')}, user=${userPermissions.join(', ')}`,
    );

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      this.logger.warn(
        `User ${user.userId} lacks required permissions: ${requiredPermissions.join(', ')}`,
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    this.logger.debug(
      `User ${user.userId} has all required permissions: ${requiredPermissions.join(
        ', ',
      )}`,
    );

    return true;
  }
}
