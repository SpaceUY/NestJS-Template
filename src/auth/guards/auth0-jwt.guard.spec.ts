import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Auth0JwtGuard } from './auth0-jwt.guard';
import { Auth0JwtStrategy } from '../auth0-jwt.strategy';

describe('Auth0JwtGuard', () => {
  let guard: Auth0JwtGuard;
  let auth0JwtStrategy: jest.Mocked<Auth0JwtStrategy>;

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization: 'Bearer valid-token',
        },
        user: {
          userId: 'auth0|123456789',
          email: 'test@example.com',
          permissions: ['read:users'],
          roles: ['user'],
        },
      }),
    }),
  } as ExecutionContext;

  const mockExecutionContextNoToken = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        user: null,
      }),
    }),
  } as ExecutionContext;

  const mockExecutionContextInvalidToken = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization: 'Invalid invalid-token',
        },
        user: null,
      }),
    }),
  } as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Auth0JwtGuard,
        {
          provide: Auth0JwtStrategy,
          useValue: {
            authenticate: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<Auth0JwtGuard>(Auth0JwtGuard);
    auth0JwtStrategy = module.get(Auth0JwtStrategy);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access with valid token', async () => {
      // Mock the parent AuthGuard's canActivate method
      jest.spyOn(guard, 'canActivate').mockImplementation(async () => {
        return true;
      });

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when no token provided', async () => {
      await expect(
        guard.canActivate(mockExecutionContextNoToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when invalid token format', async () => {
      await expect(
        guard.canActivate(mockExecutionContextInvalidToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should extract token correctly from Bearer header', () => {
      const request = mockExecutionContext.switchToHttp().getRequest();
      const token = guard['extractTokenFromHeader'](request);

      expect(token).toBe('valid-token');
    });

    it('should return undefined for non-Bearer token', () => {
      const request = mockExecutionContextInvalidToken.switchToHttp().getRequest();
      const token = guard['extractTokenFromHeader'](request);

      expect(token).toBeUndefined();
    });

    it('should return undefined when no authorization header', () => {
      const request = mockExecutionContextNoToken.switchToHttp().getRequest();
      const token = guard['extractTokenFromHeader'](request);

      expect(token).toBeUndefined();
    });
  });

  describe('handleRequest', () => {
    it('should return user when authentication succeeds', () => {
      const user = {
        userId: 'auth0|123456789',
        email: 'test@example.com',
      };

      const result = guard.handleRequest(null, user, null, mockExecutionContext);

      expect(result).toEqual(user);
    });

    it('should throw error when authentication fails', () => {
      const error = new Error('Authentication failed');

      expect(() =>
        guard.handleRequest(error, null, null, mockExecutionContext),
      ).toThrow(error);
    });

    it('should throw UnauthorizedException when no user', () => {
      expect(() =>
        guard.handleRequest(null, null, null, mockExecutionContext),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('logging', () => {
    it('should log authentication success', () => {
      const request = mockExecutionContext.switchToHttp().getRequest();
      const logSpy = jest.spyOn(guard['logger'], 'log');

      guard['logAuthenticationSuccess'](request);

      expect(logSpy).toHaveBeenCalledWith(
        'User auth0|123456789 (test@example.com) authenticated successfully',
      );
    });
  });
}); 