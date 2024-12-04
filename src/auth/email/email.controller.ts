import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { EmailAuthService } from './email.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '@prisma/client';
import { CurrentUser } from 'src/user/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from 'src/common/guard/jwt.guard';

@ApiTags('auth/email')
@Controller('auth/email')
export class EmailAuthController {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(private emailAuthService: EmailAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user by email and password' })
  @ApiResponse({ status: 200, description: 'Complete', type: LoginResponseDto })
  async login(@Body() login: LoginDto): Promise<LoginResponseDto> {
    try {
      return await this.emailAuthService.login(login);
    } catch (error) {
      this.logger.error('Email Auth Controller - login: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(Exceptions.auth.invalidCredentials);
    }
  }

  @Post('register')
  @ApiBody({ type: RegisterDto })
  @ApiOperation({ summary: 'Register user by email and password' })
  @ApiResponse({ status: 200, description: 'Complete', type: LoginResponseDto })
  async register(@Body() registerData: RegisterDto): Promise<LoginResponseDto> {
    try {
      return await this.emailAuthService.register(registerData);
    } catch (error) {
      this.logger.error('Email Auth Controller - register: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change password for a logged user' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Complete', type: String })
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() changeData: ChangePasswordDto,
    @CurrentUser() currentUser: User,
  ): Promise<string> {
    try {
      await this.emailAuthService.changePassword(
        currentUser,
        changeData.newPassword,
        changeData.currentPassword,
      );
      return 'Paassword updated successfully';
    } catch (error) {
      this.logger.error('Email Auth Controller - changePassword: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'User Forgot Password' })
  @ApiResponse({ status: 200, description: 'Complete', type: String })
  async forgotPassword(
    @Body() forgotPasswordData: ForgotPasswordDto,
  ): Promise<string> {
    try {
      await this.emailAuthService.forgotPassword(forgotPasswordData.email);
      return 'We have sent you an email to recover your password';
    } catch (error) {
      this.logger.error('Email Auth Controller - forgotPassword: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }

  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Complete', type: String })
  @ApiOperation({ summary: 'User Reset Password' })
  async resetPassword(
    @Body() resetPasswordData: ResetPasswordDto,
  ): Promise<string> {
    try {
      await this.emailAuthService.resetPassword(
        resetPasswordData.resetToken,
        resetPasswordData.newPassword,
      );
      return 'Paassword updated successfully';
    } catch (error) {
      this.logger.error('Email Auth Controller - resetPassword: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }
}
