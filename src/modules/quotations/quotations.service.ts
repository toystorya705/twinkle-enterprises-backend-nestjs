import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CustomerType, LeadSource, Prisma, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeQuotationStatus,
  normalizeUnit,
} from '../../shared/utils/enum-normalizers';
import {
  CreateQuotationDto,
  QuotationItemDto,
} from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import {
  CreateCustomerDto
} from '../customers/dto/create-customer.dto';
import {
  UpdateCustomerDto
} from '../customers/dto/update-customer.dto';
const quotationInclude = { QuotationItem: true, Customer: true, QuotationNote: true } satisfies Prisma.QuotationInclude;

type QuotationWithItems = Prisma.QuotationGetPayload<{
  include: typeof quotationInclude;
}>;

type QuotationTotalItem = {
  unitPrice?: number | null;
  price?: number | null;
  quantity?: number | null;
};

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const quotations = await this.prisma.quotation.findMany({
      include: quotationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return quotations.map((quotation) => this.toFrontendQuotation(quotation));
  }

  async findOne(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: quotationInclude,
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return this.toFrontendQuotation(quotation);
  }

  async create(dto: CreateQuotationDto) {
    const items = dto.items ?? [];
    const totals = this.calculateTotals(items, dto);

    const quotation = await this.prisma.transaction(async (tx) => {
      const status = normalizeQuotationStatus(dto.status);
      const customerId =
        status === QuotationStatus.SENT
          ? await this.syncQuotationCustomer(tx, dto, items)
          : dto.customerId;

      return tx.quotation.create({
        data: {
          id: randomUUID(),
          quotationNumber: await this.nextQuotationNumber(tx),
          customerName: dto.customerName ?? '',
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          customerCountry: dto.customerCountry,
          customerId,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          discountPercent: totals.discountPercent,
          gstPercent: totals.gstPercent,
          gstAmount: totals.gstAmount,
          total: totals.grandTotal,
          grandTotal: totals.grandTotal,
          pdfUrl: dto.pdfUrl ?? null,
          createdById: dto.createdById ?? null,
          status,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          updatedAt: new Date(),
          QuotationItem: { create: items.map((item) => this.itemWrite(item)) },
        },
        include: quotationInclude,
      });
    });

    return this.toFrontendQuotation(quotation);
  }

  async update(id: string, dto: UpdateQuotationDto) {
    await this.ensureExists(id);
    const items = dto.items;

    const quotation = await this.prisma.transaction(async (tx) => {
      if (items) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      }

      const existing = await tx.quotation.findUnique({
        where: { id },
        include: { QuotationItem: true },
      });
      const status = dto.status ? normalizeQuotationStatus(dto.status) : existing?.status;
      const effectiveItems = items ?? existing?.QuotationItem.map((item) => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku ?? undefined,
        image: item.image,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit?.toLowerCase(),
          unitPrice: item.price,
        })) ?? [];
      const totals = this.calculateTotals(effectiveItems, dto, existing ?? undefined);
      const customerId =
        status === QuotationStatus.SENT
          ? await this.syncQuotationCustomer(tx, {
              ...dto,
              customerName: dto.customerName ?? existing?.customerName,
              customerEmail: dto.customerEmail ?? existing?.customerEmail ?? undefined,
              customerPhone:
                dto.customerPhone != null
                  ? String(dto.customerPhone)
                  : existing?.customerPhone != null
                  ? String(existing.customerPhone)
                  : undefined,
              customerCountry: dto.customerCountry ?? existing?.customerCountry ?? undefined,
              customerId: dto.customerId ?? existing?.customerId ?? undefined,
            }, effectiveItems)
          : dto.customerId;

      return tx.quotation.update({
        where: { id },
        data: {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          customerCountry: dto.customerCountry,
          customerId,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          discountPercent: totals.discountPercent,
          gstPercent: totals.gstPercent,
          gstAmount: totals.gstAmount,
          total: totals.grandTotal,
          grandTotal: totals.grandTotal,
          pdfUrl: dto.pdfUrl,
          createdById: dto.createdById,
          status: dto.status ? status : undefined,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          QuotationItem: items
            ? { create: items.map((item) => this.itemWrite(item)) }
            : undefined,
        },
        include: quotationInclude,
      });
    });

    return this.toFrontendQuotation(quotation);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.quotation.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.quotation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Quotation not found');
    }
  }

  private itemWrite(item: QuotationItemDto) {
    const price = item.unitPrice ?? item.price ?? 0;
    const quantity = item.quantity ?? 1;
    return {
      id: randomUUID(),
      productId: item.productId ?? null,
      name: item.name,
      sku: item.sku,
      variantLabel: item.variantLabel ?? null,
      image: item.image ?? null,
      description: item.description ?? null,
      quantity,
      unit: item.unit ? normalizeUnit(item.unit) : null,
      price,
      total: quantity * price,
    };
  }

  private calculateSubtotal(items: QuotationTotalItem[]): number {
    return items.reduce((sum, item) => {
      const price = item.unitPrice ?? item.price ?? 0;
      const quantity = item.quantity ?? 1;
      return sum + quantity * price;
    }, 0);
  }

  private calculateTotals(
    items: QuotationTotalItem[],
    dto: Partial<CreateQuotationDto>,
    existing?: Pick<QuotationWithItems, 'subtotal' | 'discountAmount' | 'discountPercent' | 'gstPercent' | 'gstAmount' | 'grandTotal' | 'total'>,
  ) {
    const subtotal = dto.subtotal ?? (items.length ? this.calculateSubtotal(items) : existing?.subtotal ?? 0);
    const discountPercent = dto.discountPercent ?? existing?.discountPercent ?? 0;
    const discountAmount = dto.discountAmount ?? existing?.discountAmount ?? (subtotal * discountPercent) / 100;
    const taxable = Math.max(subtotal - discountAmount, 0);
    const gstPercent = dto.gstPercent ?? existing?.gstPercent ?? 18;
    const gstAmount = dto.gstAmount ?? existing?.gstAmount ?? (taxable * gstPercent) / 100;
    const grandTotal = dto.grandTotal ?? dto.total ?? existing?.grandTotal ?? taxable + gstAmount;

    return {
      subtotal,
      discountAmount,
      discountPercent,
      gstPercent,
      gstAmount,
      grandTotal,
    };
  }

  private toFrontendQuotation(quotation: QuotationWithItems) {
    return {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      customerName: quotation.customerName,
      customerEmail: quotation.customerEmail,
      customerPhone: quotation.customerPhone,
      customerCity: null,
      customerCountry: quotation.customerCountry,
      customerMessage: null,
      customerId: quotation.customerId,
      subtotal: quotation.subtotal,
      discountAmount: quotation.discountAmount,
      discountPercent: quotation.discountPercent,
      gstPercent: quotation.gstPercent,
      gstAmount: quotation.gstAmount,
      total: quotation.total,
      grandTotal: quotation.grandTotal,
      pdfUrl: quotation.pdfUrl,
      createdById: quotation.createdById,
      status: quotation.status.toLowerCase(),
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
      expiresAt: quotation.expiresAt,
      items: quotation.QuotationItem.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        variantLabel: item.variantLabel,
        image: item.image,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit?.toLowerCase(),
        unitPrice: item.price,
        totalPrice: item.total,
        createdAt: item.createdAt,
      })),
      notes: quotation.QuotationNote.map((note) => ({
        id: note.id,
        quotationId: note.quotationId,
        note: note.note,
        createdById: note.createdById,
        createdAt: note.createdAt,
      })),
    };
  }

  private async nextQuotationNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.quotation.count({
      where: {
        quotationNumber: {
          startsWith: `QT-${year}-`,
        },
      },
    });

    return `QT-${year}-${String(count + 1).padStart(4, '0')}`;
  }

   async syncQuotationCustomer(
    tx: Prisma.TransactionClient,
    dto: Partial<CreateQuotationDto>,
    items: QuotationItemDto[],
  ): Promise<string | null | undefined> {
    const name = dto.customerName?.trim() || dto.customerEmail || dto.customerPhone || 'Quotation Customer';
    const type = items.length > 0 ? CustomerType.CUSTOMER : CustomerType.LEAD;
    const leadSource = normalizeLeadSource(dto.leadSource) ?? LeadSource.QUOTATION_ENQUIRY;
    const data = {
      name,
      email: dto.customerEmail ?? null,
      phone: dto.customerPhone ?? null,
      address: dto.customerCity ?? null,
      country: dto.customerCountry ?? null,
      type,
      leadSource,
      isActive: true,
      addedById: dto.addedById ?? null,
      updatedAt: new Date(),
    };

    if (dto.customerId) {
      const existing = await tx.customer.findUnique({
        where: { id: dto.customerId },
        select: { id: true },
      });
      if (existing) {
        const customer = await tx.customer.update({
          where: { id: dto.customerId },
          data,
          select: { id: true },
        });
        return customer.id;
      }
    }

    const contactFilters = [
      ...(dto.customerEmail ? [{ email: dto.customerEmail }] : []),
      ...(dto.customerPhone ? [{ phone: dto.customerPhone }] : []),
    ];
    const existingByContact = contactFilters.length
      ? await tx.customer.findFirst({
          where: { OR: contactFilters },
          select: { id: true },
        })
      : null;

    if (existingByContact) {
      const customer = await tx.customer.update({
        where: { id: existingByContact.id },
        data,
        select: { id: true },
      });
      return customer.id;
    }

    const customer = await tx.customer.create({
      data: {
        id: randomUUID(),
        ...data,
      },
      select: { id: true },
    });
    return customer.id;
  }
  async createLeadEnquiry(
  tx: Prisma.TransactionClient,
  dto: Partial<CreateCustomerDto> & Partial<UpdateCustomerDto> & { id?: string },
): Promise<string | null> {
  const email = dto.email?.trim() || null;
  const phone = dto.phone?.trim() || null;

  const name =
    dto.name?.trim() ||
    email ||
    phone ||
    'Lead';

  const leadSource =
    normalizeLeadSource(dto.leadSource) ??
    LeadSource.WEBSITE;

  const data = {
    name,
    email,
    phone,
    address: dto.address ?? dto.city ?? null,
    country: dto.country ?? null,
    leadSource,
    isActive: true,
    addedById: dto.addedById ?? null,
    updatedAt: new Date(),
  };

  // Update by ID
  if (dto.id) {
    const existing = await tx.customer.findUnique({
      where: { id: dto.id },
      select: { id: true, type: true },
    });

    if (existing) {
      const customer = await tx.customer.update({
        where: { id: existing.id },
        data: {
          ...data,
          type:
            existing.type === CustomerType.CUSTOMER
              ? CustomerType.CUSTOMER
              : CustomerType.LEAD,
        },
        select: { id: true },
      });

      return customer.id;
    }
  }

  // Find by email/phone
  const contactFilters = [
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
  ];

  if (contactFilters.length) {
    const existing = await tx.customer.findFirst({
      where: {
        OR: contactFilters,
      },
      select: {
        id: true,
        type: true,
      },
    });

    if (existing) {
      const customer = await tx.customer.update({
        where: { id: existing.id },
        data: {
          ...data,
          type:
            existing.type === CustomerType.CUSTOMER
              ? CustomerType.CUSTOMER
              : CustomerType.LEAD,
        },
        select: { id: true },
      });

      return customer.id;
    }
  }

  // Create new lead
  const customer = await tx.customer.create({
    data: {
      id: randomUUID(),
      ...data,
      type: CustomerType.LEAD,
    },
    select: { id: true },
  });

  return customer.id;
}
}

function normalizeLeadSource(value?: string | null): LeadSource {
  const normalized = value?.toUpperCase();
  return Object.values(LeadSource).find((entry) => entry === normalized) ?? LeadSource.QUOTATION_ENQUIRY;
}
