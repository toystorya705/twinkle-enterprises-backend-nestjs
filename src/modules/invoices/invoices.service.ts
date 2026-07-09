import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CustomerType, LeadSource, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeInvoiceStatus,
  normalizePaymentStatus,
  normalizeUnit,
} from '../../shared/utils/enum-normalizers';
import { CreateInvoiceDto, InvoiceItemDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

const invoiceInclude = { InvoiceItem: true, Customer: true } satisfies Prisma.InvoiceInclude;

type InvoiceWithItems = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const invoices = await this.prisma.invoice.findMany({
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map((invoice) => this.toFrontendInvoice(invoice));
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.toFrontendInvoice(invoice);
  }

  async create(dto: CreateInvoiceDto) {
    const items = dto.items ?? [];
    const subtotal = this.calculateSubtotal(items);
    const cgst = dto.cgst ?? 0;
    const sgst = dto.sgst ?? 0;
    const total = subtotal + cgst + sgst;
    const paymentStatus = normalizePaymentStatus(dto.paymentStatus);

    const invoice = await this.prisma.transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumber(tx);
      const customerId = await this.findOrCreateInvoiceCustomer(tx, dto, paymentStatus);

      return tx.invoice.create({
        data: {
          id: randomUUID(),
          invoiceNumber,
          customerName: dto.customerName ?? '',
          email: dto.email ?? dto.customerEmail,
          phone: dto.phone,
          company: dto.company,
          address: dto.address ?? null,
          customerId,
          subtotal,
          cgst,
          sgst,
          total,
          paymentStatus,
          status: normalizeInvoiceStatus(dto.status),
          showLogo: dto.showLogo ?? false,
          updatedAt: new Date(),
          InvoiceItem: { create: items.map((item) => this.itemWrite(item)) },
        },
        include: invoiceInclude,
      });
    });

    return this.toFrontendInvoice(invoice);
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    await this.ensureExists(id);
    const items = dto.items;
    const subtotal = items ? this.calculateSubtotal(items) : undefined;
    const cgst = dto.cgst;
    const sgst = dto.sgst;

    const invoice = await this.prisma.transaction(async (tx) => {
      if (items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }

      const customerId = await this.findOrCreateInvoiceCustomer(
        tx,
        dto,
        dto.paymentStatus ? normalizePaymentStatus(dto.paymentStatus) : PaymentStatus.UNPAID,
      );

      return tx.invoice.update({
        where: { id },
        data: {
          customerName: dto.customerName,
          email: dto.email ?? dto.customerEmail,
          phone: dto.phone,
          company: dto.company,
          address: dto.address,
          customerId,
          subtotal,
          cgst,
          sgst,
          total:
            subtotal !== undefined
              ? subtotal + (cgst ?? 0) + (sgst ?? 0)
              : undefined,
          paymentStatus: dto.paymentStatus
            ? normalizePaymentStatus(dto.paymentStatus)
            : undefined,
          status: dto.status ? normalizeInvoiceStatus(dto.status) : undefined,
          showLogo: dto.showLogo,
          InvoiceItem: items
            ? { create: items.map((item) => this.itemWrite(item)) }
            : undefined,
        },
        include: invoiceInclude,
      });
    });

    return this.toFrontendInvoice(invoice);
  }

  async cancel(id: string) {
    await this.ensureExists(id);
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: invoiceInclude,
    });
    return this.toFrontendInvoice(invoice);
  }

  async remove(id: string) {
    await this.cancel(id);
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Invoice not found');
    }
  }

  private async generateInvoiceNumber(tx: Prisma.TransactionClient = this.prisma): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.invoice.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
        },
      },
    });
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private itemWrite(item: InvoiceItemDto) {
    const price = item.unitPrice ?? item.price ?? 0;
    const quantity = item.quantity ?? 1;
    const discount = item.discount ?? 0;
    const gross = quantity * price;
    const lineTotal = gross - gross * (discount / 100);

    return {
      id: randomUUID(),
      productId: item.productId ?? null,
      name: item.name ?? item.description ?? 'Item',
      variant: item.variant,
      quantity,
      unit: normalizeUnit(item.unit),
      price,
      discount,
      gstPercent: item.gstPercent,
      total: lineTotal,
    };
  }

  private calculateSubtotal(items: InvoiceItemDto[]): number {
    return items.reduce((sum, item) => {
      const price = item.unitPrice ?? item.price ?? 0;
      const quantity = item.quantity ?? 1;
      const gross = quantity * price;
      return sum + gross - gross * ((item.discount ?? 0) / 100);
    }, 0);
  }

  private async findOrCreateInvoiceCustomer(
    tx: Prisma.TransactionClient,
    dto: Partial<CreateInvoiceDto>,
    paymentStatus: PaymentStatus,
  ): Promise<string | undefined> {
    const name = dto.customerName?.trim();
    const email = (dto.email ?? dto.customerEmail)?.trim() || null;
    const phone = dto.phone?.trim() || null;

    if (!email && !phone) {
      if (!dto.customerId) return undefined;
      const existing = await tx.customer.findUnique({
        where: { id: dto.customerId },
        select: { id: true },
      });
      return existing?.id;
    }

    const targetType =
      paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.PARTIAL
        ? CustomerType.CUSTOMER
        : CustomerType.LEAD;

    const data = {
      name: name || dto.email || dto.customerEmail || dto.phone || 'Invoice Customer',
      email,
      phone,
      company: dto.company ?? null,
      address: dto.address ?? null,
      isActive: true,
      leadSource: LeadSource.MANUAL,
      updatedAt: new Date(),
    };

    if (dto.customerId) {
      const existing = await tx.customer.findUnique({
        where: { id: dto.customerId },
        select: { id: true, type: true },
      });

      if (existing) {
        const customer = await tx.customer.update({
          where: { id: dto.customerId },
          data: {
            ...data,
            type: existing.type === CustomerType.CUSTOMER ? CustomerType.CUSTOMER : targetType,
          },
          select: { id: true },
        });
        return customer.id;
      }
    }

    const matches = [
      ...(data.email ? [{ email: { equals: data.email, mode: Prisma.QueryMode.insensitive } }] : []),
      ...(data.phone ? [{ phone: data.phone }] : []),
    ];

    const existing = matches.length
      ? await tx.customer.findFirst({
          where: { OR: matches },
          select: { id: true, type: true },
        })
      : null;

    if (existing) {
      const customer = await tx.customer.update({
        where: { id: existing.id },
        data: {
          ...data,
          type: existing.type === CustomerType.CUSTOMER ? CustomerType.CUSTOMER : targetType,
        },
        select: { id: true },
      });
      return customer.id;
    }

    const customer = await tx.customer.create({
      data: {
        id: randomUUID(),
        ...data,
        type: targetType,
      },
      select: { id: true },
    });

    return customer.id;
  }

  private toFrontendInvoice(invoice: InvoiceWithItems) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerEmail: invoice.email,
      email: invoice.email,
      phone: invoice.phone,
      company: invoice.company,
      address: invoice.address,
      customerId: invoice.customerId,
      subtotal: invoice.subtotal,
      cgst: invoice.cgst ?? 0,
      sgst: invoice.sgst ?? 0,
      total: invoice.total,
      paymentStatus: invoice.paymentStatus.toLowerCase(),
      status: invoice.status.toLowerCase(),
      showLogo: invoice.showLogo,
      createdAt: invoice.createdAt,
      items: invoice.InvoiceItem.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        description: item.name,
        variant: item.variant,
        quantity: item.quantity,
        unit: item.unit.toLowerCase(),
        unitPrice: item.price,
        price: item.price,
        discount: item.discount,
        gstPercent: item.gstPercent,
        total: item.total,
      })),
    };
  }
}
