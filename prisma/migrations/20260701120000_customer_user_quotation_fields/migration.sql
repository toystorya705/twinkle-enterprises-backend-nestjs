-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('LEAD', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'WEBSITE', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM_API', 'QUOTATION_ENQUIRY');

-- AlterTable
ALTER TABLE "Customer"
  ADD COLUMN "country" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "type" "CustomerType" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "leadSource" "LeadSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "addedById" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "country" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "customerCountry" TEXT;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "roleId" TEXT,
  ADD COLUMN "addedById" TEXT;

-- Backfill direct user role from the existing join table.
UPDATE "User" u
SET "roleId" = ur."roleId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "roleId"
  FROM "UserRole"
  ORDER BY "userId", "roleId"
) ur
WHERE u."id" = ur."userId";

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
