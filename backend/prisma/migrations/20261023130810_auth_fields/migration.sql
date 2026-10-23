-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAddress" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
