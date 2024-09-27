import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthType, User } from '@prisma/client';
import { CurrentUser } from 'src/user/current-user.decorator';
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

  @Get('callback')
  @UseGuards(AuthGuard('google'))
  webCallback(@CurrentUser() user: User, @Req() req: Request): Promise<string> {
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
