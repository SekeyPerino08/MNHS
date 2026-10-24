ALTER TABLE "Term"
ADD COLUMN "gradesLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedById" TEXT;

CREATE INDEX "Term_lockedById_idx" ON "Term"("lockedById");

ALTER TABLE "Term"
ADD CONSTRAINT "Term_lockedById_fkey"
FOREIGN KEY ("lockedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Grade" ADD COLUMN "recordedById" TEXT;

CREATE INDEX "Grade_recordedById_idx" ON "Grade"("recordedById");

ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
