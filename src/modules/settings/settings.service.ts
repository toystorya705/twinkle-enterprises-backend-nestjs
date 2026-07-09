import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }
}
