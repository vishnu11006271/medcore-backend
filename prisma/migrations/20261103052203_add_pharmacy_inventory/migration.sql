-- CreateTable
CREATE TABLE "MedicineBatch" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityAvailable" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyDispense" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "dispensedByUserId" TEXT NOT NULL,
    "dispensedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyDispense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyDispenseItem" (
    "id" TEXT NOT NULL,
    "dispenseId" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyDispenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyBatchAllocation" (
    "id" TEXT NOT NULL,
    "dispenseItemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicineBatch_medicineId_expiryDate_idx" ON "MedicineBatch"("medicineId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineBatch_medicineId_batchNumber_key" ON "MedicineBatch"("medicineId", "batchNumber");

-- CreateIndex
CREATE INDEX "PharmacyDispense_prescriptionId_dispensedAt_idx" ON "PharmacyDispense"("prescriptionId", "dispensedAt");

-- CreateIndex
CREATE INDEX "PharmacyDispense_dispensedByUserId_dispensedAt_idx" ON "PharmacyDispense"("dispensedByUserId", "dispensedAt");

-- CreateIndex
CREATE INDEX "PharmacyDispenseItem_dispenseId_idx" ON "PharmacyDispenseItem"("dispenseId");

-- CreateIndex
CREATE INDEX "PharmacyDispenseItem_prescriptionItemId_idx" ON "PharmacyDispenseItem"("prescriptionItemId");

-- CreateIndex
CREATE INDEX "PharmacyDispenseItem_medicineId_idx" ON "PharmacyDispenseItem"("medicineId");

-- CreateIndex
CREATE INDEX "PharmacyBatchAllocation_dispenseItemId_idx" ON "PharmacyBatchAllocation"("dispenseItemId");

-- CreateIndex
CREATE INDEX "PharmacyBatchAllocation_batchId_idx" ON "PharmacyBatchAllocation"("batchId");

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_dispenseId_fkey" FOREIGN KEY ("dispenseId") REFERENCES "PharmacyDispense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyBatchAllocation" ADD CONSTRAINT "PharmacyBatchAllocation_dispenseItemId_fkey" FOREIGN KEY ("dispenseItemId") REFERENCES "PharmacyDispenseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyBatchAllocation" ADD CONSTRAINT "PharmacyBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
