-- CreateTable
CREATE TABLE "RazorpayWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayWebhookEvent_eventId_key" ON "RazorpayWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_eventType_receivedAt_idx" ON "RazorpayWebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_paymentId_idx" ON "RazorpayWebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_orderId_idx" ON "RazorpayWebhookEvent"("orderId");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_processed_receivedAt_idx" ON "RazorpayWebhookEvent"("processed", "receivedAt");
