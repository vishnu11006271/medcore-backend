
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { HospitalsController } from './hospitals.controller.js';
import { HospitalsService } from './hospitals.service.js';
import { HospitalRegistrationController } from './hospital-registration.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [AuthModule, PrismaModule,
    MailModule,],
  controllers: [HospitalsController, HospitalRegistrationController,],
  providers: [HospitalsService],
})
export class HospitalsModule {}
