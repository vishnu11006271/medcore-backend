
import { Module } from '@nestjs/common';

import { BillingController } from './billing.controller.js';
import { RazorpayWebhookController } from './razorpay-webhook.controller.js';
import { BillingService } from './billing.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InvoicePdfService } from './invoice-pdf.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    BillingController,
    RazorpayWebhookController,
  ],
  providers: [BillingService, InvoicePdfService],
  exports: [BillingService],
})
export class BillingModule {}
