import { Inject, Injectable, Logger } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { AuthType, User } from '@prisma/client';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import { RegisterDto } from './dto/register.dto';
import EmailDeliveryIntegratorFactory, {
  EmailDeliveryIntegratorName,
} from 'src/common/factory/emailDeliveryIntegrator/emailDeliveryIntegrator.factory';
import { PrismaService } from 'src/prisma/prisma.service';
import { EncryptService } from '../core/auth-token/encrypt.service';
import forgotPasswordEmail from 'src/email/sendgrid/emails/forgot-password.email';
import { EmailType } from 'src/email/sendgrid/core/email-type';

@Injectable()
export class BasicAuthService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly encryptService: EncryptService,
    @Inject(forgotPasswordEmail.KEY)
    private readonly forgotPasswordMail: EmailType<typeof forgotPasswordEmail>,
  ) {}

  async login(login: LoginDto): Promise<LoginResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: login.email,
        },
      });
      if (!user) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      const isPasswordValid = await this.encryptService.validatePassword(
        login.password,
        user.password,
      );
      if (!isPasswordValid) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }

      const { token, refreshToken } =
        await this.authTokenService.generateAuthTokens(user, AuthType.EMAIL);

      return {
        token,
        refreshToken,
      };
    } catch (error) {
      this.logger.error('BasicAuthService - login: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(Exceptions.auth.invalidPayload);
    }
  }

  async register(registerData: RegisterDto): Promise<LoginResponseDto> {
    try {
      if (!registerData.password) {
        throw new RequestException(Exceptions.auth.invalidPayload);
      }
      const hashedPassword = await this.encryptService.hashPassword(
        registerData.password,
      );
      registerData.password = hashedPassword;
      const user = await this.prisma.user.create({
        data: {
          ...registerData,
          authType: AuthType.EMAIL,
        },
      });
      const { token, refreshToken } =
        await this.authTokenService.generateAuthTokens(user, AuthType.EMAIL);
      return { token, refreshToken };
    } catch (error) {
      this.logger.error('BasicAuthService - register: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(Exceptions.auth.invalidPayload);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      const resetToken =
        await this.authTokenService.generateResetPasswordAuthToken(
          user.id,
          AuthType.EMAIL,
        );

      const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

      const emailDeliveryIntegrator =
        EmailDeliveryIntegratorFactory.getEmailDeliveryIntegrator(
          EmailDeliveryIntegratorName.SENDGRID,
        );

      await emailDeliveryIntegrator.sendEmail(
        this.forgotPasswordMail,
        forgotPasswordEmail,
        email,
        { resetLink },
        {
          subject: 'Forgot your password?',
        },
      );
    } catch (error) {
      this.logger.error('BasicAuthService - forgotPassword: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    try {
      const { userId } =
        this.authTokenService.validateAuthResetPasswordToken(resetToken);
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      if (user.authType !== AuthType.EMAIL) {
        throw new RequestException(Exceptions.auth.invalidPayload);
      }
      await this.changePassword(user, newPassword);
    } catch (error) {
      this.logger.error('BasicAuthService - resetPassword: ', error);
      if (error instanceof RequestException) throw error;
      throw new RequestException(Exceptions.auth.invalidPayload);
    }
  }

  async changePassword(
    user: User,
    newPassword: string,
    currentPassword?: string,
  ): Promise<void> {
    try {
      if (user.authType !== AuthType.EMAIL) {
        throw new RequestException(Exceptions.auth.invalidNotLoggedEmail);
      }
      if (!user.password) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      if (
        currentPassword &&
        !(await this.encryptService.validatePassword(
          currentPassword,
          user.password,
        ))
      ) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      const hashPassword = await this.encryptService.hashPassword(newPassword);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashPassword,
        },
      });
    } catch (error) {
      this.logger.error('BasicAuthService - changePassword: ', error);
      if (error instanceof RequestException) throw error;
      throw new RequestException(Exceptions.auth.invalidPayload);
    }
  }

  async refreshToken(
    user: User,
  ): Promise<{ token: string; refreshToken: string }> {
    try {
      const { token, refreshToken } =
        await this.authTokenService.generateAuthTokens(user, user.authType);
      return {
        token,
        refreshToken,
      };
    } catch (error) {
      this.logger.error('EmailAuthService - login: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(Exceptions.auth.invalidPayload);
    }
  }
}
