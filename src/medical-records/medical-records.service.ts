
import {
    BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto.js';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto.js';
import { CreateVitalSignDto } from './dto/create-vital-sign.dto.js';

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateMedicalRecordDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!doctor) {
      throw new ForbiddenException(
        'A registered doctor profile is required',
      );
    }

    if (!doctor.user.isActive || !doctor.user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Your account must be active and email-verified',
      );
    }

    const appointment =
      await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
      });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (
      appointment.doctorId !== doctor.id ||
      appointment.hospitalId !== doctor.user.hospitalId
    ) {
      throw new ForbiddenException(
        'You can create medical records only for your own hospital appointments',
      );
    }

    if (
      appointment.status !== 'IN_PROGRESS' &&
      appointment.status !== 'COMPLETED'
    ) {
      throw new ConflictException(
        'The appointment must be in progress or completed',
      );
    }

    const existing =
      await this.prisma.medicalRecord.findUnique({
        where: { appointmentId: appointment.id },
        select: { id: true },
      });

    if (existing) {
      throw new ConflictException(
        'A medical record already exists for this appointment',
      );
    }

    return this.prisma.medicalRecord.create({
      data: {
        hospitalId: appointment.hospitalId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: doctor.id,
        diagnosis: dto.diagnosis,
        symptoms: dto.symptoms,
        clinicalNotes: dto.clinicalNotes,
        status: 'DRAFT',
        treatmentPlan: dto.treatmentPlan,
      },
    });
  }

  async findOne(userId: string, recordId: string) {
    // 1. Find the logged-in doctor's profile.
    const doctor = await this.prisma.doctor.findUnique({
    where: { userId },
    include: {
        user: {
        select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
        },
        },
    },
    });

    if (
    !doctor ||
    !doctor.user.isActive ||
    !doctor.user.emailVerifiedAt
    ) {
    throw new ForbiddenException(
        'An active, verified doctor account is required',
    );
    }

    // 2. Find the requested medical record.
    const record = await this.prisma.medicalRecord.findUnique({
    where: { id: recordId },
    });

    if (!record) {
    throw new NotFoundException('Medical record not found');
    }

    // 3. Only the doctor who owns the record,
    // in the same hospital, can access it.
    if (
    record.doctorId !== doctor.id ||
    record.hospitalId !== doctor.user.hospitalId
    ) {
    throw new ForbiddenException(
        'You do not have permission to access this medical record',
    );
    }

    // 4. Return the authorized record.
    return record;
    }

    async finalize(userId: string, recordId: string) {
    // Step 1: Find the logged-in doctor's profile.
    const doctor = await this.prisma.doctor.findUnique({
        where: { userId },
        include: {
        user: {
            select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
            },
        },
        },
    });

    if (
        !doctor ||
        !doctor.user.isActive ||
        !doctor.user.emailVerifiedAt
    ) {
        throw new ForbiddenException(
        'An active, verified doctor account is required',
        );
    }

    // Step 2: Find the medical record.
    const record = await this.prisma.medicalRecord.findUnique({
        where: { id: recordId },
    });

    if (!record) {
        throw new NotFoundException('Medical record not found');
    }

    // Step 3: Verify doctor ownership and hospital.
    if (
        record.doctorId !== doctor.id ||
        record.hospitalId !== doctor.user.hospitalId
    ) {
        throw new ForbiddenException(
        'You cannot finalize this medical record',
        );
    }

    // Step 4: Prevent finalizing an already finalized record.
    if (record.status === 'FINALIZED') {
        throw new ConflictException(
        'This medical record is already finalized',
        );
    }

    // Step 5: Update only if the record is still a draft.
    const result = await this.prisma.medicalRecord.updateMany({
        where: {
        id: recordId,
        doctorId: doctor.id,
        hospitalId: doctor.user.hospitalId,
        status: 'DRAFT',
        },
        data: {
        status: 'FINALIZED',
        },
    });

    // Protect against concurrent finalization requests.
    if (result.count === 0) {
        throw new ConflictException(
        'The record was already finalized or has changed',
        );
    }

    // Step 6: Return the updated record.
    return this.prisma.medicalRecord.findUniqueOrThrow({
        where: { id: recordId },
    });
    }

    
    async update(
    userId: string,
    recordId: string,
    dto: UpdateMedicalRecordDto,
    ) {
    // 1. Reject an empty update.
    if (
        dto.diagnosis === undefined &&
        dto.symptoms === undefined &&
        dto.clinicalNotes === undefined &&
        dto.treatmentPlan === undefined
    ) {
        throw new BadRequestException(
        'At least one field must be provided',
        );
    }

    // 2. Verify the doctor's account.
    const doctor = await this.prisma.doctor.findUnique({
        where: { userId },
        include: {
        user: {
            select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
            },
        },
        },
    });

    if (
        !doctor ||
        !doctor.user.isActive ||
        !doctor.user.emailVerifiedAt
    ) {
        throw new ForbiddenException(
        'An active, verified doctor account is required',
        );
    }

    // 3. Find the record.
    const record = await this.prisma.medicalRecord.findUnique({
        where: { id: recordId },
    });

    if (!record) {
        throw new NotFoundException('Medical record not found');
    }

    // 4. Verify ownership and hospital access.
    if (
        record.doctorId !== doctor.id ||
        record.hospitalId !== doctor.user.hospitalId
    ) {
        throw new ForbiddenException(
        'You cannot update this medical record',
        );
    }

    // 5. Finalized records cannot be edited.
    if (record.status !== 'DRAFT') {
        throw new ConflictException(
        'Finalized medical records cannot be edited',
        );
    }

    // 6. Update only while the record is still a draft.
    const result = await this.prisma.medicalRecord.updateMany({
        where: {
        id: recordId,
        doctorId: doctor.id,
        hospitalId: doctor.user.hospitalId,
        status: 'DRAFT',
        },
        data: {
        ...(dto.diagnosis !== undefined && {
            diagnosis: dto.diagnosis,
        }),
        ...(dto.symptoms !== undefined && {
            symptoms: dto.symptoms,
        }),
        ...(dto.clinicalNotes !== undefined && {
            clinicalNotes: dto.clinicalNotes,
        }),
        ...(dto.treatmentPlan !== undefined && {
            treatmentPlan: dto.treatmentPlan,
        }),
        },
    });

    if (result.count === 0) {
        throw new ConflictException(
        'The record has changed or is no longer editable',
        );
    }

    // 7. Return the updated record.
    return this.prisma.medicalRecord.findUniqueOrThrow({
        where: { id: recordId },
    });
    }

    async findMyHistory(
    userId: string,
    page: number,
    limit: number,
    ) {
    // 1. Find the patient linked to the authenticated user.
    const patient = await this.prisma.patient.findUnique({
        where: { userId },
        select: {
        id: true,
        hospitalId: true,
        },
    });

    if (!patient) {
        throw new ForbiddenException(
        'A registered patient profile is required',
        );
    }

    // 2. Calculate pagination.
    const skip = (page - 1) * limit;

    // 3. Retrieve only this patient's finalized records.
    const where = {
        patientId: patient.id,
        hospitalId: patient.hospitalId,
        status: 'FINALIZED' as const,
    };

    // 4. Fetch the page and total count together.
    const [records, total] = await this.prisma.$transaction([
        this.prisma.medicalRecord.findMany({
        where,
        select: {
            id: true,
            appointmentId: true,
            doctorId: true,
            diagnosis: true,
            symptoms: true,
            clinicalNotes: true,
            status: true,
            recordedAt: true,
            updatedAt: true,
        },
        orderBy: {
            recordedAt: 'desc',
        },
        skip,
        take: limit,
        }),
        this.prisma.medicalRecord.count({ where }),
    ]);

    // 5. Return the records and pagination metadata.
    return {
        data: records,
        meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        },
    };
    }

    
    async addVitals(userId: string, recordId: string, dto: CreateVitalSignDto) {
    // 1. Require at least one measurement.
    const {
        systolicBP,
        diastolicBP,
        pulseBpm,
        temperatureC,
        respiratoryRate,
        oxygenSaturation,
        heightCm,
        weightKg,
        notes,
    } = dto;

    const measurements = [
        systolicBP,
        diastolicBP,
        pulseBpm,
        temperatureC,
        respiratoryRate,
        oxygenSaturation,
        heightCm,
        weightKg,
    ];

    if (measurements.every((value) => value === undefined)) {
        throw new BadRequestException(
        'At least one vital measurement must be provided',
        );
    }

    // 2. Find the doctor's profile and account status.
    const doctor = await this.prisma.doctor.findUnique({
        where: { userId },
        include: {
        user: {
            select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
            },
        },
        },
    });

    if (
        !doctor ||
        !doctor.user.isActive ||
        !doctor.user.emailVerifiedAt
    ) {
        throw new ForbiddenException(
        'An active, verified doctor account is required',
        );
    }

    // 3. Find the medical record.
    const record = await this.prisma.medicalRecord.findUnique({
        where: { id: recordId },
    });

    if (!record) {
        throw new NotFoundException('Medical record not found');
    }

    // 4. Verify ownership and hospital access.
    if (
        record.doctorId !== doctor.id ||
        record.hospitalId !== doctor.user.hospitalId
    ) {
        throw new ForbiddenException(
        'You do not have permission to add vitals to this record',
        );
    }

    // 5. Only draft records can be modified.
    if (record.status !== 'DRAFT') {
        throw new ConflictException(
        'Vitals cannot be added to a finalized medical record',
        );
    }

    // 6. Create the vitals.
    return this.prisma.vitalSign.create({
        data: {
        medicalRecordId: recordId,
        systolicBP,
        diastolicBP,
        pulseBpm,
        temperatureC,
        respiratoryRate,
        oxygenSaturation,
        heightCm,
        weightKg,
        notes,
        },
    });
    }

    async findVitals(userId: string, recordId: string) {
    // 1. Verify the doctor's profile and account.
    const doctor = await this.prisma.doctor.findUnique({
        where: { userId },
        include: {
        user: {
            select: {
            hospitalId: true,
            isActive: true,
            emailVerifiedAt: true,
            },
        },
        },
    });

    if (
        !doctor ||
        !doctor.user.isActive ||
        !doctor.user.emailVerifiedAt
    ) {
        throw new ForbiddenException(
        'An active, verified doctor account is required',
        );
    }

    // 2. Find the record.
    const record = await this.prisma.medicalRecord.findUnique({
        where: { id: recordId },
        select: {
        id: true,
        doctorId: true,
        hospitalId: true,
        },
    });

    if (!record) {
        throw new NotFoundException('Medical record not found');
    }

    // 3. Verify access.
    if (
        record.doctorId !== doctor.id ||
        record.hospitalId !== doctor.user.hospitalId
    ) {
        throw new ForbiddenException(
        'You do not have permission to view these vitals',
        );
    }

    // 4. Return vitals, newest first.
    return this.prisma.vitalSign.findMany({
        where: { medicalRecordId: recordId },
        orderBy: { recordedAt: 'desc' },
    });
    }


}
