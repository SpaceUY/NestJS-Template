import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findUserByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { auth0Id },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email },
    });
  }
}
