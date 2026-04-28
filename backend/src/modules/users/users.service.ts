import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email } });
  }

  async create(email: string, passwordHash: string) {
    return this.prisma.user.create({ data: { email, passwordHash } });
  }
}
