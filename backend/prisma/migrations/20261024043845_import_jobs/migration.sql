-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('STUDENTS', 'TEACHERS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEWED', 'COMMITTED', 'DISCARDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "options" JSONB,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "warningRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "previewRows" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "commitResult" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_createdById_createdAt_idx" ON "ImportJob"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_status_expiresAt_idx" ON "ImportJob"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ImportJob_fileHash_status_idx" ON "ImportJob"("fileHash", "status");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
