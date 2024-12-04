import { Inject, Injectable, Logger } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthTokenService } from '../core/auth-token/auth-token.service';
import { AuthTypeEnum, User } from '@prisma/client';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import { RegisterDto } from './dto/register.dto';
import forgotPasswordEmail from '../../email/emails/forgot-password.email';
import EmailDeliveryIntegratorFactory, {
  EmailDeliveryIntegratorName,
} from 'src/common/factory/emailDeliveryIntegrator/emailDeliveryIntegrator.factory';
import { EmailType } from 'src/email/core/email-type';
import { PrismaService } from 'src/prisma/prisma.service';
import { EncryptService } from '../core/auth-token/encrypt.service';

@Injectable()
export class EmailAuthService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(
    private authTokenService: AuthTokenService,
    private prisma: PrismaService,
    private encryptService: EncryptService,
    @Inject(forgotPasswordEmail.KEY)
    private readonly forgotPasswordMail: EmailType<typeof forgotPasswordEmail>,
  ) {}

  async login(login: LoginDto): Promise<LoginResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        email: login.email,
        deleted: false,
      });
      if (
        !user ||
        !(await this.encryptService.validPassword(
          login.password,
          user.password,
        ))
      ) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }

      const jwt = await this.authTokenService.generateAuthToken(
        user.id,
        AuthTypeEnum.EMAIL,
      );

      return {
        token: jwt,
      };
    } catch (error) {
      this.logger.error('EmailAuthService - login: ', error);
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
      const hashPassword = await this.encryptService.hashPassword(
        registerData.password,
      );
      registerData.password = hashPassword;
      const user = await this.prisma.user.create({
        ...registerData,
        authType: AuthTypeEnum.EMAIL,
      });
      const jwt = await this.authTokenService.generateAuthToken(
        user.id,
        AuthTypeEnum.EMAIL,
      );
      return { token: jwt };
    } catch (error) {
      this.logger.error('EmailAuthService - register: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(Exceptions.auth.invalidPayload);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        email,
        deleted: false,
      });
      if (!user) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      const resetToken =
        await this.authTokenService.generateResetPasswordAuthToken(
          user.id,
          AuthTypeEnum.EMAIL,
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
          subject: '¿Perdiste tu contraseña?',
        },
      );
    } catch (error) {
      this.logger.error('EmailAuthService - forgotPassword: ', error);
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
        await this.authTokenService.validateAuthResetPasswordToken(resetToken);
      const user = await this.prisma.user.findUnique({
        id: userId,
        deleted: false,
      });
      if (!user) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      if (user.authType !== AuthTypeEnum.EMAIL) {
        throw new RequestException(Exceptions.auth.invalidPayload);
      }
      await this.changePassword(user, newPassword);
    } catch (error) {
      this.logger.error('EmailAuthService - resetPassword: ', error);
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
      if (user.authType !== AuthTypeEnum.EMAIL) {
        throw new RequestException(Exceptions.auth.invalidNotLoggedEmail);
      }
      if (!user.password) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      if (
        currentPassword &&
        !(await this.encryptService.validPassword(
          currentPassword,
          user.password,
        ))
      ) {
        throw new RequestException(Exceptions.auth.invalidCredentials);
      }
      const hashPassword = await this.encryptService.hashPassword(newPassword);
      await this.prisma.user.update(user.id, {
        password: hashPassword,
      });
    } catch (error) {
      this.logger.error('EmailAuthService - changePassword: ', error);
      if (error instanceof RequestException) throw error;
      throw new RequestException(Exceptions.auth.invalidPayload);
    }
  }
}
