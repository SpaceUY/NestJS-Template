import {
  CanActivate,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { auth0Scope, type Auth0ScopeConfig } from './config/auth0.scope';

/**
 * Makes `AUTH0_ENABLED=false` mean the route is gone. See
 * `src/auth/google/google-enabled.guard.ts` for why the controller cannot
 * simply be left out of the module metadata: the flag is only readable once
 * the container has resolved the `auth0` scope, which is after the routes are
 * mapped.
 *
 * Without it, `POST /auth/auth0/login` on a disabled provider reaches
 * `Auth0Service`, which calls `/userinfo` on an unconfigured domain and
 * reports the resulting failure as `invalidCredentials` — a 401 that blames
 * the caller for a provider that is switched off.
 */
@Injectable()
export class Auth0EnabledGuard implements CanActivate {
  constructor(
    @Inject(auth0Scope.KEY)
    private readonly auth0Conf: Auth0ScopeConfig,
  ) {}

  canActivate(): boolean {
    if (!this.auth0Conf.enabled) {
      throw new NotFoundException();
    }

    return true;
  }
}
