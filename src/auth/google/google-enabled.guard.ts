import {
  CanActivate,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { googleScope, GoogleScopeConfig } from './config/google.scope';

/**
 * Makes `GOOGLE_OAUTH_ENABLED=false` mean the routes are gone.
 *
 * The provider's `enabled` flag only becomes readable once the container has
 * resolved the `google` scope, which is after Nest has already mapped
 * `GoogleController`'s routes — so the controller cannot be left out of the
 * module metadata. This guard is the next best thing: it runs before
 * `AuthGuard('google')` (controller-level guards run before method-level
 * ones), so a disabled provider answers 404 instead of 500-ing on a Passport
 * strategy that was never registered.
 *
 * Not a `RequestException`: this is not an authentication failure, it is a
 * route that is not part of this deployment's API.
 */
@Injectable()
export class GoogleEnabledGuard implements CanActivate {
  constructor(
    @Inject(googleScope.KEY)
    private readonly googleConf: GoogleScopeConfig,
  ) {}

  canActivate(): boolean {
    if (!this.googleConf.enabled) {
      throw new NotFoundException();
    }

    return true;
  }
}
