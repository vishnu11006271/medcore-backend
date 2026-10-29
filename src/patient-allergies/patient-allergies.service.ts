
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePatientAllergyDto } from './dto/create-patient-allergy.dto.js';
import { UpdatePatientAllergyDto } from './dto/update-patient-allergy.dto.js';

@Injectable()
export class PatientAllergiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verify the doctor's profile, account status, email,
   * and hospital assignment.
   */
  private async getAuthorizedDoctor(userId: string) {
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

    if (
      !doctor.user.isActive ||
      !doctor.user.emailVerifiedAt
    ) {
      throw new ForbiddenException(
        'An active, verified doctor account is required',
      );
    }

    if (!doctor.user.hospitalId) {
      throw new ForbiddenException(
        'The doctor must be assigned to a hospital',
      );
    }

    return {
      ...doctor,
      hospitalId: doctor.user.hospitalId,
    };
  }

  /**
   * Ensure the patient belongs to the doctor's hospital.
   */
  private async verifyPatientInHospital(
    patientId: string,
    hospitalId: string,
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId,
      },
      select: { id: true },
    });

    if (!patient) {
      throw new NotFoundException(
        'Patient not found in your hospital',
      );
    }

    return patient;
  }

  /**
   * Create an allergy for a patient in the same hospital.
   */
  async create(
    userId: string,
    dto: CreatePatientAllergyDto,
  ) {
    const doctor = await this.getAuthorizedDoctor(userId);

    await this.verifyPatientInHospital(
      dto.patientId,
      doctor.hospitalId,
    );

    return this.prisma.patientAllergy.create({
      data: {
        hospitalId: doctor.hospitalId,
        patientId: dto.patientId,
        allergen: dto.allergen.trim(),
        type: dto.type,
        reaction: dto.reaction?.trim(),
        severity: dto.severity,
        notes: dto.notes?.trim(),
      },
    });
  }

  /**
   * List allergies for a patient in the same hospital.
   */
  async findAll(userId: string, patientId: string) {
    const doctor = await this.getAuthorizedDoctor(userId);

    await this.verifyPatientInHospital(
      patientId,
      doctor.hospitalId,
    );

    return this.prisma.patientAllergy.findMany({
      where: {
        hospitalId: doctor.hospitalId,
        patientId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update an allergy belonging to the doctor's hospital.
   */
  async update(
    userId: string,
    allergyId: string,
    dto: UpdatePatientAllergyDto,
  ) {
    const doctor = await this.getAuthorizedDoctor(userId);

    const data = {
      ...(dto.allergen !== undefined && {
        allergen: dto.allergen.trim(),
      }),
      ...(dto.type !== undefined && {
        type: dto.type,
      }),
      ...(dto.reaction !== undefined && {
        reaction: dto.reaction?.trim() ?? null,
      }),
      ...(dto.severity !== undefined && {
        severity: dto.severity,
      }),
      ...(dto.notes !== undefined && {
        notes: dto.notes?.trim() ?? null,
      }),
    };

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'At least one allergy field must be provided',
      );
    }

    const existing = await this.prisma.patientAllergy.findFirst({
      where: {
        id: allergyId,
        hospitalId: doctor.hospitalId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        'Allergy record not found',
      );
    }

    // Update only if the record still belongs to this hospital.
    const result = await this.prisma.patientAllergy.updateMany({
      where: {
        id: allergyId,
        hospitalId: doctor.hospitalId,
      },
      data,
    });

    if (result.count === 0) {
      throw new ConflictException(
        'The allergy record has changed or is no longer available',
      );
    }

    return this.prisma.patientAllergy.findFirstOrThrow({
      where: {
        id: allergyId,
        hospitalId: doctor.hospitalId,
      },
    });
  }

  /**
   * Deactivate an allergy without deleting its history.
   */
  async deactivate(
    userId: string,
    allergyId: string,
  ) {
    const doctor = await this.getAuthorizedDoctor(userId);

    const result = await this.prisma.patientAllergy.updateMany({
      where: {
        id: allergyId,
        hospitalId: doctor.hospitalId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count === 0) {
      const existing = await this.prisma.patientAllergy.findFirst({
        where: {
          id: allergyId,
          hospitalId: doctor.hospitalId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          'Allergy record not found',
        );
      }

      throw new ConflictException(
        'Allergy record is already inactive or has changed',
      );
    }

    return this.prisma.patientAllergy.findFirstOrThrow({
      where: {
        id: allergyId,
        hospitalId: doctor.hospitalId,
      },
    });
  }
}
