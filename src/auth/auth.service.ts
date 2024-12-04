import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateUser(userId: string, type: string): Promise<User | null> {
    if (type !== 'auth') {
      return null;
    }
    const user = await this.prisma.user.findUnique({ id: userId });
    if (!user) {
      return null;
    }
    return user;
  }
}
