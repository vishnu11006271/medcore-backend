import { Module } from '@nestjs/common';

import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}