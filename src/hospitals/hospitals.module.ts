
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { HospitalsController } from './hospitals.controller.js';
import { HospitalsService } from './hospitals.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
})
export class HospitalsModule {}
