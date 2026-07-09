import { Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

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

  async create(dto: CreateUserDto) {
    const role = await this.prisma.role.upsert({
      where: { name: dto.role },
      update: {},
      create: {
        id: randomUUID(),
        name: dto.role,
        description: dto.role === 'admin' ? 'Administrator' : 'Staff',
      },
    });

    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        email: dto.email.toLowerCase().trim(),
        name: dto.name,
        passwordHash: await hash(dto.password, 12),
        roleId: role.id,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
        UserRole: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: { Role: true, UserRole: { include: { Role: true } } },
    });

    return user;
  }
}
