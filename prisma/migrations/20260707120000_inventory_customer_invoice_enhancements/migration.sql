-- Customer business type
CREATE TYPE "BusinessType" AS ENUM ('HOTEL', 'RESTAURANT', 'CATERING', 'RETAIL', 'OTHER');

ALTER TABLE "Customer"
ADD COLUMN "businessType" "BusinessType";

-- Variant-level multi-image references and SKU uniqueness.
ALTER TABLE "Variant"
ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");

-- Company branding is opt-in for new invoices.
ALTER TABLE "Invoice"
ALTER COLUMN "showLogo" SET DEFAULT false;
