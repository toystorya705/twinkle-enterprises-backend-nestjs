import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type AuditInput = {
  userId?: string | null;
  event: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId: input.userId ?? null,
          event: input.event,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata ?? undefined,
        },
      });
    } catch (error) {
      this.logger.warn(`Audit log failed for ${input.event}: ${(error as Error).message}`);
    }
  }
}
