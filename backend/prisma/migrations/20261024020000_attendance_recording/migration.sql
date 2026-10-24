ALTER TABLE "Attendance" RENAME COLUMN "note" TO "remarks";
ALTER TABLE "Attendance" ADD COLUMN "recordedById" TEXT;

CREATE INDEX "Attendance_recordedById_idx" ON "Attendance"("recordedById");

ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
