import { ExecutionContext } from '@nestjs/common';
import { User } from './user.decorator';
import { Auth0User } from '../auth0-jwt.strategy';

describe('User Decorator', () => {
  const mockUser: Auth0User = {
    userId: 'auth0|123456789',
    email: 'test@example.com',
    name: 'Test User',
    permissions: ['read:users'],
    roles: ['user'],
    authType: 'AUTH0' as any,
  };

  const mockExecutionContext: ExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        user: mockUser,
      }),
    }),
  } as ExecutionContext;

  it('should extract the full user object when no data parameter is provided', () => {
    const result = User(undefined, mockExecutionContext);

    expect(result).toEqual(mockUser);
  });

  it('should extract specific user property when data parameter is provided', () => {
    const result = User('userId', mockExecutionContext);

    expect(result).toBe('auth0|123456789');
  });

  it('should extract email property', () => {
    const result = User('email', mockExecutionContext);

    expect(result).toBe('test@example.com');
  });

  it('should extract permissions property', () => {
    const result = User('permissions', mockExecutionContext);

    expect(result).toEqual(['read:users']);
  });

  it('should extract roles property', () => {
    const result = User('roles', mockExecutionContext);

    expect(result).toEqual(['user']);
  });

  it('should return undefined for non-existent property', () => {
    const result = User(
      'nonExistentProperty' as keyof Auth0User,
      mockExecutionContext,
    );

    expect(result).toBeUndefined();
  });

  it('should handle request with no user', () => {
    const contextWithoutUser: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: null,
        }),
      }),
    } as ExecutionContext;

    const result = User(undefined, contextWithoutUser);

    expect(result).toBeNull();
  });
});
