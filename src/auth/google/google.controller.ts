import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../user/current-user.decorator';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { AuthType } from '../../database/entities/auth-type.enum';
import { User } from '../../database/entities/user.entity';
import { GoogleService } from './google.service';

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
