import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        country: true,
        companyName: true,
        avatarUrl: true,
        roleId: true,
        addedById: true,
        isActive: true,
        createdAt: true,
        Role: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        UserRole: { include: { Role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
