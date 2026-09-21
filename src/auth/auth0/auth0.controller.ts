import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Auth0LoginDto } from './dto/auth0-login.dto';
import { Auth0Service } from './auth0.service';
import { Auth0EnabledGuard } from './auth0-enabled.guard';

// See `GoogleController`: with `AUTH0_ENABLED=false` the route answers 404
// rather than failing as if the caller's token were bad.
@UseGuards(Auth0EnabledGuard)
@Controller('auth/auth0')
export class Auth0Controller {
  constructor(private readonly auth0Service: Auth0Service) {}

  @Post('login')
  login(@Body() { accessToken }: Auth0LoginDto): Promise<string> {
    return this.auth0Service.login(accessToken);
  }
}
