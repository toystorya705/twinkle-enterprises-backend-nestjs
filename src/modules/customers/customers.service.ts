import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessType, CustomerType, LeadSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: this.customerCreateData(dto) });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: this.customerUpdateData(dto) });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.assertCustomersCanBeDeleted([id]);
    await this.prisma.customer.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { id, deleted: true, softDeleted: true };
  }

  async bulkAction(dto: { ids?: string[]; action?: string; status?: string }) {
    const ids = [...new Set(dto.ids ?? [])].filter(Boolean);
    if (!ids.length) {
      return { updated: 0, ids: [] };
    }

    if (dto.action === 'delete') {
      const blockedIds = await this.customerIdsWithDocuments(ids);
      const deletableIds = ids.filter((id) => !blockedIds.includes(id));
      const result = deletableIds.length
        ? await this.prisma.customer.updateMany({
            where: { id: { in: deletableIds } },
            data: { isActive: false, deletedAt: new Date() },
          })
        : { count: 0 };
      return {
        updated: result.count,
        ids: deletableIds,
        skippedIds: blockedIds,
        deleted: true,
        softDeleted: true,
      };
    }

    const isActive = dto.action === 'restore'
      ? true
      : dto.action === 'archive'
        ? false
        : dto.action === 'changeStatus'
          ? normalizeCustomerStatus(dto.status)
          : undefined;

    if (isActive === undefined) {
      throw new BadRequestException('Unsupported customer bulk action');
    }

    const result = await this.prisma.customer.updateMany({
      where: { id: { in: ids } },
      data: {
        isActive,
        deletedAt: dto.action === 'restore' ? null : undefined,
      },
    });

    return { updated: result.count, ids, isActive };
  }

  public customerCreateData(dto: CreateCustomerDto): Prisma.CustomerUncheckedCreateInput {
    return {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      businessType: normalizeBusinessType(dto.businessType),
      address: dto.address,
      country: dto.country,
      isActive: dto.isActive ?? true,
      type: normalizeCustomerType(dto.type),
      leadSource: normalizeLeadSource(dto.leadSource),
      addedById: dto.addedById ?? null,
      updatedAt: new Date(),
    };
  }

  private customerUpdateData(dto: UpdateCustomerDto): Prisma.CustomerUncheckedUpdateInput {
    return {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      businessType: dto.businessType === null ? null : normalizeBusinessType(dto.businessType),
      address: dto.address,
      country: dto.country,
      isActive: dto.isActive,
      type: dto.type ? normalizeCustomerType(dto.type) : undefined,
      leadSource: dto.leadSource ? normalizeLeadSource(dto.leadSource) : undefined,
      addedById: dto.addedById,
    };
  }

  private async assertCustomersCanBeDeleted(ids: string[]): Promise<void> {
    const blockedIds = await this.customerIdsWithDocuments(ids);
    if (blockedIds.length) {
      throw new BadRequestException(
        'Customer has invoices or quotations and cannot be deleted. Archive the customer instead.',
      );
    }
  }

  private async customerIdsWithDocuments(ids: string[]): Promise<string[]> {
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, phone: true },
    });
    const customerIdsByEmail = new Map(
      customers
        .filter((customer) => customer.email)
        .map((customer) => [customer.email!.toLowerCase(), customer.id]),
    );
    const customerIdsByPhone = new Map(
      customers
        .filter((customer) => customer.phone != null)
        .map((customer) => [String(customer.phone), customer.id]),
    );
    const emails = [...customerIdsByEmail.keys()];
    const phones = [...customerIdsByPhone.keys()];

    const [invoiceRefs, quotationRefs] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where: {
          OR: [
            { customerId: { in: ids } },
            ...(emails.length ? [{ email: { in: emails, mode: Prisma.QueryMode.insensitive } }] : []),
            ...(phones.length ? [{ phone: { in: phones } }] : []),
          ],
        },
        select: { customerId: true, email: true, phone: true },
      }),
      this.prisma.quotation.findMany({
        where: {
          OR: [
            { customerId: { in: ids } },
            ...(emails.length ? [{ customerEmail: { in: emails, mode: Prisma.QueryMode.insensitive } }] : []),
            ...(phones.length ? [{ customerPhone: { in: phones } }] : []),
          ],
        },
        select: { customerId: true, customerEmail: true, customerPhone: true },
      }),
    ]);

    const blocked = new Set<string>();
    for (const ref of invoiceRefs) {
      if (ref.customerId && ids.includes(ref.customerId)) blocked.add(ref.customerId);
      const emailMatch = ref.email ? customerIdsByEmail.get(ref.email.toLowerCase()) : undefined;
      const phoneMatch = ref.phone != null ? customerIdsByPhone.get(String(ref.phone)) : undefined;
      if (emailMatch) blocked.add(emailMatch);
      if (phoneMatch) blocked.add(phoneMatch);
    }
    for (const ref of quotationRefs) {
      if (ref.customerId && ids.includes(ref.customerId)) blocked.add(ref.customerId);
      const emailMatch = ref.customerEmail ? customerIdsByEmail.get(ref.customerEmail.toLowerCase()) : undefined;
      const phoneMatch = ref.customerPhone != null ? customerIdsByPhone.get(String(ref.customerPhone)) : undefined;
      if (emailMatch) blocked.add(emailMatch);
      if (phoneMatch) blocked.add(phoneMatch);
    }

    return [...blocked];
  }
}

function normalizeCustomerType(value?: string | null): CustomerType {
  return value?.toUpperCase() === CustomerType.LEAD
    ? CustomerType.LEAD
    : CustomerType.CUSTOMER;
}

function normalizeLeadSource(value?: string | null): LeadSource {
  const normalized = value?.toUpperCase();
  return Object.values(LeadSource).find((entry) => entry === normalized) ?? LeadSource.MANUAL;
}

function normalizeBusinessType(value?: string | null): BusinessType | undefined {
  const normalized = value?.replace(/\s+/g, '_').toUpperCase();
  return Object.values(BusinessType).find((entry) => entry === normalized);
}

function normalizeCustomerStatus(value?: string | null): boolean {
  const normalized = value?.toLowerCase();
  if (normalized === 'active') return true;
  if (normalized === 'inactive' || normalized === 'archived') return false;
  throw new BadRequestException('Unsupported customer status');
}
