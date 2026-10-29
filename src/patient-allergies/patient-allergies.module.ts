
import { Module } from '@nestjs/common';
import { PatientAllergiesController } from './patient-allergies.controller.js';
import { PatientAllergiesService } from './patient-allergies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [PatientAllergiesController],
  providers: [PatientAllergiesService, PrismaService],
})
export class PatientAllergiesModule {}
