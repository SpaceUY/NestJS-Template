import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { string } from 'joi';
import { CurrentUser } from 'src/user/current-user.decorator';
import { User } from 'src/user/user.model';
import { AuthType } from '../auth-types.enum';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { GoogleService } from './google.service';

@Controller('auth/google')
export class GoogleController {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly googleService: GoogleService,
  ) {}

  @Get('web')
  @UseGuards(AuthGuard('google'))
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  web(): void {}

  @Get('web/callback')
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
