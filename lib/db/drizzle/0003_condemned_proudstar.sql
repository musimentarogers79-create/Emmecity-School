ALTER TABLE "students"
  ADD CONSTRAINT "students_school_id_unique"
  UNIQUE USING INDEX "students_school_id_idx";