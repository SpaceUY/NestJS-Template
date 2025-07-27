import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class Auth0JwtGuard extends AuthGuard('auth0-jwt') {
  private readonly logger = new Logger(Auth0JwtGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No JWT token provided in request');
      throw new UnauthorizedException('No JWT token provided');
    }

    try {
      // Call the parent AuthGuard's canActivate method
      const result = await super.canActivate(context);

      if (result) {
        this.logger.debug(
          `Authentication successful for user: ${request.user?.['userId']}`,
        );

        // Add custom logic here if needed (e.g., logging, audit trails)
        this.logAuthenticationSuccess(request);
      }

      return result as boolean;
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private logAuthenticationSuccess(request: Request): void {
    const user = request.user as any;
    this.logger.log(
      `User ${user?.userId} (${user?.email}) authenticated successfully`,
    );
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      this.logger.error(
        `Authentication error: ${err?.message || info?.message}`,
      );
      throw err || new UnauthorizedException('Authentication failed');
    }
    return user;
  }
}
