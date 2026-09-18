import { Body, Controller, Post } from '@nestjs/common';
import { Auth0LoginDto } from './dto/auth0-login.dto';
import { Auth0Service } from './auth0.service';

@Controller('auth/auth0')
export class Auth0Controller {
  constructor(private readonly auth0Service: Auth0Service) {}

  @Post('login')
  login(@Body() { accessToken }: Auth0LoginDto): Promise<string> {
    return this.auth0Service.login(accessToken);
  }
}
