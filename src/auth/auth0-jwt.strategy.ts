import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { Auth0ConfigService } from '../config/auth0-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { User, AuthType } from '@prisma/client';

export interface Auth0JwtPayload {
  iss: string; // Issuer
  sub: string; // Subject (user ID)
  aud: string | string[]; // Audience
  iat: number; // Issued at
  exp: number; // Expiration time
  azp?: string; // Authorized party
  scope?: string; // Scopes
  permissions?: string[]; // Custom permissions claim
  'https://your-app.com/roles'?: string[]; // Custom roles claim (example)
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
}

export interface Auth0User {
  userId: string;
  email?: string;
  name?: string;
  permissions: string[];
  roles: string[];
  authType: AuthType;
}

@Injectable()
export class Auth0JwtStrategy extends PassportStrategy(Strategy, 'auth0-jwt') {
  private readonly logger = new Logger(Auth0JwtStrategy.name);

  constructor(
    private readonly auth0Config: Auth0ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: auth0Config.jwksUri,
      }),
      audience: auth0Config.audience,
      issuer: auth0Config.issuer,
      algorithms: [auth0Config.algorithm],
      ignoreExpiration: false,
    });

    this.logger.log('Auth0 JWT Strategy initialized');
  }

  async validate(payload: Auth0JwtPayload): Promise<Auth0User> {
    this.logger.debug(`Validating JWT payload for user: ${payload.sub}`);

    try {
      // Validate required claims
      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token: missing subject claim');
      }

      if (!payload.aud) {
        throw new UnauthorizedException(
          'Invalid token: missing audience claim',
        );
      }

      // Validate audience (can be string or array)
      const audiences = Array.isArray(payload.aud)
        ? payload.aud
        : [payload.aud];
      if (!audiences.includes(this.auth0Config.audience)) {
        throw new UnauthorizedException('Invalid token: audience mismatch');
      }

      // Validate issuer
      if (payload.iss !== this.auth0Config.issuer) {
        throw new UnauthorizedException('Invalid token: issuer mismatch');
      }

      // Extract permissions and roles from custom claims
      const permissions = payload.permissions || [];
      const roles = payload['https://your-app.com/roles'] || [];

      // Create Auth0User object
      const auth0User: Auth0User = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        permissions,
        roles,
        authType: 'AUTH0' as AuthType, // TODO: Use AuthType.AUTH0 once Prisma client is regenerated
      };

      this.logger.debug(`JWT validation successful for user: ${payload.sub}`);
      this.logger.debug(`User permissions: ${permissions.join(', ')}`);
      this.logger.debug(`User roles: ${roles.join(', ')}`);

      return auth0User;
    } catch (error) {
      this.logger.error(`JWT validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Optional: Sync user profile with local database
   * This can be called after successful JWT validation
   */
  async syncUserWithDatabase(auth0User: Auth0User): Promise<User | null> {
    try {
      // Check if user exists in local database
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: auth0User.userId }, { email: auth0User.email }],
        },
      });

      if (!user) {
        // Create new user if not exists
        user = await this.prisma.user.create({
          data: {
            id: auth0User.userId,
            email: auth0User.email || '',
            name: auth0User.name || '',
            verified: true, // Auth0 users are pre-verified
            authType: 'AUTH0' as AuthType, // TODO: Use AuthType.AUTH0 once Prisma client is regenerated
          },
        });
        this.logger.log(`Created new user in database: ${auth0User.userId}`);
      } else {
        // Update existing user if needed
        if (user.authType !== 'AUTH0') {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              authType: 'AUTH0' as AuthType, // TODO: Use AuthType.AUTH0 once Prisma client is regenerated
              verified: true,
              name: auth0User.name || user.name,
            },
          });
          this.logger.log(`Updated user auth type to AUTH0: ${user.id}`);
        }
      }

      return user;
    } catch (error) {
      this.logger.error(`Failed to sync user with database: ${error.message}`);
      return null;
    }
  }
}
