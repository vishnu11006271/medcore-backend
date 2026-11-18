
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { PlatformAnalyticsController } from './platform-analytics.controller.js';
import { PlatformAnalyticsService } from './platform-analytics.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformAnalyticsController],
  providers: [PlatformAnalyticsService],
})
export class PlatformAnalyticsModule {}
