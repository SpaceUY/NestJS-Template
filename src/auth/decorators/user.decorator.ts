import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Auth0User } from '../auth0-jwt.strategy';

/**
 * Decorator to extract the authenticated user from the request
 * @param data - Optional property key to extract from user object
 * @example
 * @Get('profile')
 * getProfile(@User() user: Auth0User) {
 *   return user;
 * }
 *
 * @Get('profile')
 * getProfile(@User('userId') userId: string) {
 *   return userId;
 * }
 */
export const User = createParamDecorator(
  (
    data: keyof Auth0User | undefined,
    ctx: ExecutionContext,
  ): Auth0User | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
