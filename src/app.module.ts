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
    AppointmentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
