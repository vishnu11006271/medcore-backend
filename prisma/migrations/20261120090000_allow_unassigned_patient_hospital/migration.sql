-- Patients may register before choosing a hospital.
-- Existing patient records retain their current hospital and patient number.
ALTER TABLE "Patient"
  ALTER COLUMN "hospitalId" DROP NOT NULL,
  ALTER COLUMN "patientNumber" DROP NOT NULL;
