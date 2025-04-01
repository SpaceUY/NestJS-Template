import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { Exceptions } from 'src/common/exception/exceptions';
import baseConfig from 'src/config/base.config';

@Injectable()
export class EncryptService {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(
    @Inject(baseConfig.KEY)
    private readonly baseConf: ConfigType<typeof baseConfig>,
  ) {}

  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.baseConf.lengthPassword);
    } catch (error) {
      this.logger.error('EncryptService - hashPassword: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }

  async validatePassword(
    password: string,
    savedPassword: string | null,
  ): Promise<boolean> {
    try {
      if (!savedPassword) {
        return false;
      }
      return await bcrypt.compare(password, savedPassword);
    } catch (error) {
      this.logger.error('EncryptService - validatePassword: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new RequestException(
        Exceptions.generic.internalServer({ msg: error.message }),
      );
    }
  }
}
