import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('No user found in request for roles check');
      throw new ForbiddenException('User not authenticated');
    }

    const userRoles = user.roles || [];

    this.logger.debug(
      `Checking roles for user ${user.userId}: required=${requiredRoles.join(
        ', ',
      )}, user=${userRoles.join(', ')}`,
    );

    // Check if user has any of the required roles
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

    this.logger.debug(
      `User ${user.userId} has required role: ${requiredRoles.join(', ')}`,
    );

    return true;
  }
}
