import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { HospitalsModule } from './hospitals/hospitals.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { MedicalRecordsModule } from './medical-records/medical-records.module.js';
import { PrescriptionsModule } from './prescriptions/prescriptions.module.js';
import { PatientAllergiesService } from './patient-allergies/patient-allergies.service.js';
import { PatientAllergiesController } from './patient-allergies/patient-allergies.controller.js';
import { PatientAllergiesModule } from './patient-allergies/patient-allergies.module.js';
import { LaboratoryModule } from './laboratory/laboratory.module.js';
import { PharmacyModule } from './pharmacy/pharmacy.module.js';
import { BillingModule } from './billing/billing.module.js';
import { MailModule } from './mail/mail.module.js';
import { HospitalDashboardModule } from './hospital-dashboard/hospital-dashboard.module.js';
import { UsersModule } from './users/users.module.js';
import { PlatformAnalyticsModule } from './platform-analytics/platform-analytics.module.js';
import { StaffModule } from './staff/staff.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    HospitalsModule,
    DepartmentsModule,
    DoctorsModule,
    AvailabilityModule,
    AppointmentsModule,
    MedicalRecordsModule,
    PrescriptionsModule,
    PatientAllergiesModule,
    LaboratoryModule,
    PharmacyModule,
    BillingModule,
    MailModule,
    HospitalDashboardModule,
    UsersModule,
    PlatformAnalyticsModule,
    StaffModule],
  controllers: [AppController, PatientAllergiesController],
  providers: [AppService, PatientAllergiesService],
})
export class AppModule {}
