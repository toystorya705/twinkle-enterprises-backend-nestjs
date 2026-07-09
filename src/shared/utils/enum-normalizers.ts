import { InvoiceStatus, PaymentStatus, ProductStatus, QuotationStatus, UnitType } from '@prisma/client';

export function normalizeUnit(value?: string | null): UnitType {
  const normalized = value?.replace(/\s+/g, '_').toUpperCase();
  return Object.values(UnitType).find((entry) => entry === normalized) ?? UnitType.PCS;
}

export function normalizeProductStatus(value?: string | null): ProductStatus {
  const normalized = value?.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  const status = Object.values(ProductStatus).find((entry) => entry === normalized);
  if (status) return status;
  if (normalized === 'RESTORE' || normalized === 'RESTORED') {
    return ProductStatus.ACTIVE;
  }
  return ProductStatus.ACTIVE;
}

export function normalizePaymentStatus(value?: string | null): PaymentStatus {
  const normalized = value?.toUpperCase();
  return Object.values(PaymentStatus).find((entry) => entry === normalized) ?? PaymentStatus.UNPAID;
}

export function normalizeInvoiceStatus(value?: string | null): InvoiceStatus {
  return value?.toUpperCase() === InvoiceStatus.CANCELLED
    ? InvoiceStatus.CANCELLED
    : InvoiceStatus.ACTIVE;
}

export function normalizeQuotationStatus(value?: string | null): QuotationStatus {
  const normalized = value?.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  if (normalized === 'NEW' || normalized === 'CONTACTED' || normalized === 'PRICE_ADDED') {
    return QuotationStatus.DRAFT;
  }
  if (normalized === 'QUOTATION_SENT') {
    return QuotationStatus.SENT;
  }
  if (normalized === 'APPROVED') {
    return QuotationStatus.ACCEPTED;
  }
  if (normalized === 'CLOSED' || normalized === 'CANCELLED' || normalized === 'EXPIRED') {
    return QuotationStatus.DECLINED;
  }
  const status = Object.values(QuotationStatus).find((entry) => entry === normalized);
  if (status) return status;

  return QuotationStatus.DRAFT;
}
