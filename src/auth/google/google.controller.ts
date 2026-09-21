import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GoogleEnabledGuard } from './google-enabled.guard';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { AuthType } from '../../database/entities/auth-type.enum';
import { User } from '../../database/entities/user.entity';
import { GoogleService } from './google.service';

// Every route here is behind `GoogleEnabledGuard`, so a deployment with
// `GOOGLE_OAUTH_ENABLED=false` answers 404 instead of reaching a Passport
// strategy that was never registered. Controller-level guards run before the
// method-level `AuthGuard('google')`.
@UseGuards(GoogleEnabledGuard)
@Controller('auth/google')
export class GoogleController {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly googleService: GoogleService,
  ) {}

  @Get('web')
  @UseGuards(AuthGuard('google'))
  web(): void {}

  @Get('callback')
  @UseGuards(AuthGuard('google'))
  webCallback(@CurrentUser() user: User): Promise<string> {
    return this.authTokenService.generateAuthToken(user, AuthType.GOOGLE);
  }

  @Post('mobile/register')
  mobileRegister(@Body() { idToken }: { idToken: string }): Promise<string> {
    return this.googleService.register(idToken);
  }

  @Post('mobile/login')
  mobileLogin(@Body() { idToken }: { idToken: string }): Promise<string> {
    return this.googleService.login(idToken);
  }
}
