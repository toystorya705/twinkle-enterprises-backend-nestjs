-- Align the NestJS Prisma schema with the fields/tables that the Lovable
-- frontend previously relied on in Supabase migrations.

ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'GRAM';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'LITRE';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'ML';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'CUSTOM';

ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'DOZ';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductStatus') THEN
    CREATE TYPE "ProductStatus" AS ENUM (
      'ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED'
    );
  END IF;
END $$;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "shortDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "fullDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "seoTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "seoDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
   ADD COLUMN IF NOT EXISTS "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';


UPDATE "Product"
SET
  "shortDescription" = COALESCE(NULLIF("shortDescription", ''), COALESCE("description", '')),
  "fullDescription" = COALESCE(NULLIF("fullDescription", ''), COALESCE("description", ''));

ALTER TABLE "Variant"

  ADD COLUMN IF NOT EXISTS "customUnit" TEXT,
  ADD COLUMN IF NOT EXISTS "unit" "UnitType" NOT NULL DEFAULT 'PCS',
  ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER,
  ADD COLUMN IF NOT EXISTS "stockQuantity" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ProductImage"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

ALTER TABLE "Quotation"
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT;

UPDATE "Quotation"
SET "grandTotal" = CASE WHEN "grandTotal" = 0 THEN "total" ELSE "grandTotal" END;

ALTER TABLE "QuotationItem"
  ADD COLUMN IF NOT EXISTS "variantLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE TABLE IF NOT EXISTS "ProductVideo" (
  "id" TEXT NOT NULL,
  "videoUrl" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewMedia" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QuotationNote" (
  "id" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotationNote_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductVideo_productId_fkey'
  ) THEN
    ALTER TABLE "ProductVideo"
      ADD CONSTRAINT "ProductVideo_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Review_userId_fkey'
  ) THEN
    ALTER TABLE "Review"
      ADD CONSTRAINT "Review_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewMedia_reviewId_fkey'
  ) THEN
    ALTER TABLE "ReviewMedia"
      ADD CONSTRAINT "ReviewMedia_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "Review"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Quotation_createdById_fkey'
  ) THEN
    ALTER TABLE "Quotation"
      ADD CONSTRAINT "Quotation_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuotationNote_quotationId_fkey'
  ) THEN
    ALTER TABLE "QuotationNote"
      ADD CONSTRAINT "QuotationNote_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuotationNote_createdById_fkey'
  ) THEN
    ALTER TABLE "QuotationNote"
      ADD CONSTRAINT "QuotationNote_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProductVideo_productId_idx" ON "ProductVideo"("productId");
CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON "Review"("productId");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");
CREATE INDEX IF NOT EXISTS "Review_status_idx" ON "Review"("status");
CREATE INDEX IF NOT EXISTS "ReviewMedia_reviewId_idx" ON "ReviewMedia"("reviewId");
CREATE INDEX IF NOT EXISTS "QuotationNote_quotationId_idx" ON "QuotationNote"("quotationId");
CREATE INDEX IF NOT EXISTS "QuotationNote_createdById_idx" ON "QuotationNote"("createdById");
