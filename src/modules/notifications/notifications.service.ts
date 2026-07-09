import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
