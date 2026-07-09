import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CustomerType,
  Enquiry_status,
  Enquiry_type,
  LeadSource,
  Prisma,
  QuotationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEnquiryDto,
  EnquiryStatus,
  EnquiryType,
} from './dto/create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { EnquiryQueryDto } from './dto/enquiry-query.dto';

const WEBSITE_LEAD_SOURCE = 'website';

const enquiryInclude = {
  Customer: true,
  Quotation: true,
  User: true,
} satisfies Prisma.EnquiryInclude;

const enquiryQuotationInclude = {
  QuotationItem: true,
  Customer: true,
} satisfies Prisma.QuotationInclude;

type EnquiryWithRelations = Prisma.EnquiryGetPayload<{
  include: typeof enquiryInclude;
}>;

type EnquiryQuotation = Prisma.QuotationGetPayload<{
  include: typeof enquiryQuotationInclude;
}>;

@Injectable()
export class EnquiryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnquiryDto) {
    const enquiry = await this.prisma.transaction(async (tx) => {
      const customerId = await this.findOrCreateWebsiteLead(tx, dto);

      return tx.enquiry.create({
        data: {
          id: randomUUID(),
          customer_id: customerId,
          quotation_id: dto.quotationId ?? null,
          name: dto.name,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          company: dto.company ?? null,
          city: dto.city ?? null,
          country: dto.country ?? null,
          message: dto.message ?? null,
          enquiry_type: normalizeEnquiryType(dto.enquiryType) ?? Enquiry_type.general,
          status: Enquiry_status.new,
          lead_source: WEBSITE_LEAD_SOURCE,
          updated_at: new Date(),
        },
        include: enquiryInclude,
      });
    });

    return this.toFrontendEnquiry(enquiry);
  }

  async findAll(query: EnquiryQueryDto) {
    const {
      search,
      status,
      enquiryType,
      leadSource,
      page = '1',
      limit = '20',
    } = query;
    const normalizedLeadSource = normalizeLeadSource(leadSource);

    const skip = (+page - 1) * +limit;

    const where: Prisma.EnquiryWhereInput = {
      ...(status && { status: normalizeEnquiryStatus(status) }),
      ...(enquiryType && { enquiry_type: normalizeEnquiryType(enquiryType) }),
      ...(normalizedLeadSource && { lead_source: normalizedLeadSource }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.enquiry.findMany({
        where,
        include: enquiryInclude,
        orderBy: { created_at: 'desc' },
        skip,
        take: +limit,
      }),
      this.prisma.enquiry.count({ where }),
    ]);

    return {
      items: items.map((enquiry) => this.toFrontendEnquiry(enquiry)),
      total,
      page: +page,
      limit: +limit,
    };
  }

  async findOne(id: string) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id },
      include: enquiryInclude,
    });

    if (!enquiry) {
      throw new NotFoundException('Enquiry not found');
    }

    return this.toFrontendEnquiry(enquiry);
  }

  async update(id: string, dto: UpdateEnquiryDto) {
    const enquiry = await this.prisma.enquiry.update({
      where: { id },
      data: this.enquiryUpdateData(dto),
      include: enquiryInclude,
    });

    return this.toFrontendEnquiry(enquiry);
  }

  async markContacted(id: string) {
    const enquiry = await this.prisma.enquiry.update({
      where: { id },
      data: {
        status: Enquiry_status.contacted,
        contacted_at: new Date(),
      },
      include: enquiryInclude,
    });

    return this.toFrontendEnquiry(enquiry);
  }

  async close(id: string) {
    const enquiry = await this.prisma.enquiry.update({
      where: { id },
      data: { status: Enquiry_status.closed },
      include: enquiryInclude,
    });

    return this.toFrontendEnquiry(enquiry);
  }

  async remove(id: string) {
    const enquiry = await this.prisma.enquiry.delete({ where: { id } });
    return { id: enquiry.id, deleted: true };
  }

  async convertToQuotation(id: string) {
    return this.prisma.transaction(async (tx) => {
      const enquiry = await tx.enquiry.findUnique({
        where: { id },
        include: {
          Customer: true,
          Quotation: { include: enquiryQuotationInclude },
          User: true,
        },
      });

      if (!enquiry) {
        throw new NotFoundException('Enquiry not found');
      }

      if (enquiry.Quotation) {
        await tx.enquiry.update({
          where: { id },
          data: { status: Enquiry_status.quoted },
        });
        return this.toFrontendQuotation(enquiry.Quotation);
      }

      const quotation = await tx.quotation.create({
        data: {
          id: randomUUID(),
          quotationNumber: await this.nextQuotationNumber(tx),
          customerName: enquiry.name,
          customerEmail: enquiry.email,
          customerPhone: enquiry.phone,
          customerCountry: enquiry.country,
          customerId: enquiry.customer_id,
          subtotal: 0,
          total: 0,
          grandTotal: 0,
          status: QuotationStatus.DRAFT,
          updatedAt: new Date(),
        },
        include: enquiryQuotationInclude,
      });

      await tx.enquiry.update({
        where: { id },
        data: {
          quotation_id: quotation.id,
          status: Enquiry_status.quoted,
        },
      });

      return this.toFrontendQuotation(quotation);
    });
  }

  private enquiryUpdateData(dto: UpdateEnquiryDto): Prisma.EnquiryUncheckedUpdateInput {
    return {
      quotation_id: dto.quotationId,
      name: dto.name,
      company: dto.company,
      city: dto.city,
      country: dto.country,
      message: dto.message,
      enquiry_type: normalizeEnquiryType(dto.enquiryType),
      status: normalizeEnquiryStatus(dto.status),
      assigned_to: dto.assignedTo,
      notes: dto.notes,
      is_active: dto.isActive,
      updated_at: new Date(),
    };
  }

  private async findOrCreateWebsiteLead(
    tx: Prisma.TransactionClient,
    dto: CreateEnquiryDto,
  ): Promise<string> {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const phone = dto.phone?.trim() || null;
    const company = dto.company?.trim() || null;
    const city = dto.city?.trim() || null;
    const country = dto.country?.trim() || null;

    const existing = await tx.customer.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, type: true },
    });

    const data = {
      name,
      email,
      phone,
      company,
      address: city,
      country,
      isActive: true,
      leadSource: LeadSource.WEBSITE,
      addedById: null,
      updatedAt: new Date(),
    };

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

  private async nextQuotationNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.quotation.count({
      where: { quotationNumber: { startsWith: `QUO-${year}-` } },
    });

    return `QUO-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private toFrontendEnquiry(enquiry: EnquiryWithRelations) {
    return {
      id: enquiry.id,
      enquiryNumber: `ENQ-${enquiry.created_at.getFullYear()}-${enquiry.id.slice(-6).toUpperCase()}`,
      customerId: enquiry.customer_id,
      customerName: enquiry.name,
      customerEmail: enquiry.email,
      customerPhone: enquiry.phone,
      customerCompany: enquiry.company,
      city: enquiry.city,
      country: enquiry.country,
      message: enquiry.message,
      source: enquiry.lead_source,
      status: enquiry.status === Enquiry_status.quoted ? 'quotationCreated' : enquiry.status,
      assignedUserId: enquiry.assigned_to,
      assignedUserName: enquiry.User?.name ?? null,
      items: [],
      notes: enquiry.notes,
      quotationId: enquiry.quotation_id,
      quotationNumber: enquiry.Quotation?.quotationNumber ?? null,
      createdAt: enquiry.created_at,
      updatedAt: enquiry.updated_at,
    };
  }

  private toFrontendQuotation(quotation: EnquiryQuotation) {
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
      total: quotation.total,
      status: quotation.status.toLowerCase(),
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
      expiresAt: quotation.expiresAt,
      items: quotation.QuotationItem.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        image: item.image,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit?.toLowerCase(),
        unitPrice: item.price,
        totalPrice: item.total,
      })),
    };
  }
}

function normalizeLeadSource(value?: string | null): string | undefined {
  const normalized = value?.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  if (!normalized) return undefined;
  return Object.values(LeadSource).map((source) => source.toLowerCase()).includes(normalized)
    ? normalized
    : undefined;
}

function normalizeEnquiryType(value?: string | null): Enquiry_type | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const match = Object.values(Enquiry_type).find((entry) => entry === normalized);
  return match;
}

function normalizeEnquiryStatus(value?: string | null): Enquiry_status | undefined {
  if (!value) return undefined;
  const normalized = value === 'quotationCreated' ? EnquiryStatus.QUOTED : value;
  const match = Object.values(Enquiry_status).find((entry) => entry === normalized.toLowerCase());
  return match;
}
