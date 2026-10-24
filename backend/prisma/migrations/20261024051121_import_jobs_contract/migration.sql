/*
  Warnings:

  - You are about to drop the column `commitResult` on the `ImportJob` table. All the data in the column will be lost.
  - You are about to drop the column `errorRows` on the `ImportJob` table. All the data in the column will be lost.
  - You are about to drop the column `previewRows` on the `ImportJob` table. All the data in the column will be lost.
  - You are about to drop the column `totalRows` on the `ImportJob` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ImportJob` table. All the data in the column will be lost.
  - You are about to drop the column `validRows` on the `ImportJob` table. All the data in the column will be lost.
  - You are about to drop the column `warningRows` on the `ImportJob` table. All the data in the column will be lost.
  - Added the required column `totals` to the `ImportJob` table without a default value. This is not possible if the table is not empty.
  - Made the column `options` on table `ImportJob` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ImportJob" DROP CONSTRAINT "ImportJob_createdById_fkey";

-- DropIndex
DROP INDEX "ImportJob_createdById_createdAt_idx";

-- DropIndex
DROP INDEX "ImportJob_fileHash_status_idx";

-- AlterTable
ALTER TABLE "ImportJob" DROP COLUMN "commitResult",
DROP COLUMN "errorRows",
DROP COLUMN "previewRows",
DROP COLUMN "totalRows",
DROP COLUMN "updatedAt",
DROP COLUMN "validRows",
DROP COLUMN "warningRows",
ADD COLUMN     "result" JSONB,
ADD COLUMN     "rows" JSONB,
ADD COLUMN     "totals" JSONB NOT NULL,
ALTER COLUMN "options" SET NOT NULL,
ALTER COLUMN "createdById" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ImportJob_createdById_idx" ON "ImportJob"("createdById");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
