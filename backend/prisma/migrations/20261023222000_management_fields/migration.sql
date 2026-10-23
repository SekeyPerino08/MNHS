ALTER TABLE "Teacher"
ADD COLUMN "department" TEXT,
ADD COLUMN "contactNo" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Subject"
ADD COLUMN "description" TEXT;

ALTER TABLE "Section"
ADD COLUMN "schoolYearId" TEXT,
ADD COLUMN "adviserId" TEXT;

UPDATE "Section"
SET "schoolYearId" = (
  SELECT "id"
  FROM "SchoolYear"
  ORDER BY "isCurrent" DESC, "startDate" DESC
  LIMIT 1
)
WHERE "schoolYearId" IS NULL;

ALTER TABLE "Section"
ALTER COLUMN "schoolYearId" SET NOT NULL;

ALTER TABLE "Section"
DROP CONSTRAINT IF EXISTS "Section_name_gradeLevel_key";

DROP INDEX IF EXISTS "Section_name_gradeLevel_key";

ALTER TABLE "Section"
ADD CONSTRAINT "Section_schoolYearId_fkey"
FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Section"
ADD CONSTRAINT "Section_adviserId_fkey"
FOREIGN KEY ("adviserId") REFERENCES "Teacher"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Section_schoolYearId_gradeLevel_name_key"
ON "Section"("schoolYearId", "gradeLevel", "name");

CREATE UNIQUE INDEX "Section_schoolYearId_adviserId_key"
ON "Section"("schoolYearId", "adviserId");

CREATE INDEX "Section_schoolYearId_idx" ON "Section"("schoolYearId");
CREATE INDEX "Section_adviserId_idx" ON "Section"("adviserId");
