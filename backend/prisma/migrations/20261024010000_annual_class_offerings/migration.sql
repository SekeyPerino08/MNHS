UPDATE "ClassOffering" AS offering
SET "schoolYearId" = section."schoolYearId"
FROM "Section" AS section
WHERE section."id" = offering."sectionId"
  AND offering."schoolYearId" <> section."schoolYearId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ClassOffering"
    GROUP BY "subjectId", "sectionId", "schoolYearId"
    HAVING COUNT(DISTINCT "teacherId") > 1
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate term offerings: teachers differ across terms for the same subject and section';
  END IF;
END $$;

CREATE TEMP TABLE "_ClassOfferingMerge" AS
WITH ranked AS (
  SELECT
    offering."id",
    FIRST_VALUE(offering."id") OVER (
      PARTITION BY offering."subjectId", offering."sectionId", offering."schoolYearId"
      ORDER BY term."termNumber", offering."createdAt", offering."id"
    ) AS "keeperId",
    ROW_NUMBER() OVER (
      PARTITION BY offering."subjectId", offering."sectionId", offering."schoolYearId"
      ORDER BY term."termNumber", offering."createdAt", offering."id"
    ) AS "rank"
  FROM "ClassOffering" AS offering
  JOIN "Term" AS term ON term."id" = offering."termId"
)
SELECT "id", "keeperId"
FROM ranked
WHERE "rank" > 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Attendance" AS attendance
    LEFT JOIN "_ClassOfferingMerge" AS merge ON merge."id" = attendance."classOfferingId"
    GROUP BY attendance."studentId", COALESCE(merge."keeperId", attendance."classOfferingId"), attendance."date"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate term offerings: duplicate attendance records would conflict for the same student and date';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Grade" AS grade
    LEFT JOIN "_ClassOfferingMerge" AS merge ON merge."id" = grade."classOfferingId"
    GROUP BY grade."studentId", COALESCE(merge."keeperId", grade."classOfferingId"), grade."termId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate term offerings: duplicate grades would conflict for the same student and term';
  END IF;
END $$;

UPDATE "Attendance" AS attendance
SET "classOfferingId" = merge."keeperId"
FROM "_ClassOfferingMerge" AS merge
WHERE attendance."classOfferingId" = merge."id";

UPDATE "Grade" AS grade
SET "classOfferingId" = merge."keeperId"
FROM "_ClassOfferingMerge" AS merge
WHERE grade."classOfferingId" = merge."id";

DELETE FROM "ClassOffering" AS offering
USING "_ClassOfferingMerge" AS merge
WHERE offering."id" = merge."id";

ALTER TABLE "ClassOffering" DROP CONSTRAINT "ClassOffering_termId_fkey";
DROP INDEX "ClassOffering_termId_idx";
DROP INDEX "ClassOffering_subjectId_sectionId_termId_key";
ALTER TABLE "ClassOffering" DROP COLUMN "termId";

CREATE UNIQUE INDEX "ClassOffering_subjectId_sectionId_schoolYearId_key"
ON "ClassOffering"("subjectId", "sectionId", "schoolYearId");

DROP TABLE "_ClassOfferingMerge";
