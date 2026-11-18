import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HospitalDashboardController } from './hospital-dashboard.controller.js';
import { HospitalDashboardService } from './hospital-dashboard.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [HospitalDashboardController],
  providers: [HospitalDashboardService],
})
export class HospitalDashboardModule {}