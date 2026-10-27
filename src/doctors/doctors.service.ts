import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { UpdateDoctorDto } from './dto/update-doctor.dto.js';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hospitalId: string, dto: CreateDoctorDto) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, status: true },
    });

    if (!hospital) {
      throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'Hospital not found',
      });
    }

    if (hospital.status !== 'VERIFIED') {
      throw new BadRequestException({
        code: 'HOSPITAL_NOT_VERIFIED',
        message: 'Doctors can only be added to verified hospitals',
      });
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId,
          hospitalId,
          isActive: true,
        },
      });

      if (!department) {
        throw new BadRequestException({
          code: 'INVALID_DEPARTMENT',
          message: 'Department is inactive or does not belong to this hospital',
        });
      }
    }

    const email = dto.email.trim().toLowerCase();
    const licenseNumber = dto.licenseNumber.trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    const existingDoctor = await this.prisma.doctor.findUnique({
      where: { licenseNumber },
    });

    if (existingDoctor) {
      throw new ConflictException({
        code: 'LICENSE_ALREADY_EXISTS',
        message: 'This medical license number is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const otp = randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      const doctor = await this.prisma.$transaction(async (tx) => {
        // Invalidate older, unused email-verification codes.
        await tx.emailOtp.updateMany({
          where: {
            email,
            purpose: 'EMAIL_VERIFICATION',
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        });

        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            phone: dto.phone?.trim() || null,
            role: 'DOCTOR',
            hospitalId,
            isActive: true,
            emailVerifiedAt: null,
          },
        });

        const profile = await tx.doctor.create({
          data: {
            userId: user.id,
            departmentId: dto.departmentId || null,
            licenseNumber,
            specialization: dto.specialization.trim(),
            qualification: dto.qualification?.trim() || null,
            experienceYears: dto.experienceYears ?? null,
            consultationFee: dto.consultationFee ?? 0,
            bio: dto.bio?.trim() || null,
          },
          select: {
            id: true,
            departmentId: true,
            licenseNumber: true,
            specialization: true,
            qualification: true,
            experienceYears: true,
            consultationFee: true,
            bio: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                emailVerifiedAt: true,
                hospitalId: true,
              },
            },
          },
        });

        await tx.emailOtp.create({
          data: {
            userId: user.id,
            email,
            codeHash,
            purpose: 'EMAIL_VERIFICATION',
            expiresAt,
          },
        });

        return profile;
      });

      // Development only. Replace with your email provider before deployment.
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Doctor onboarding] Verification OTP for ${email}: ${otp}`);
      }

      return doctor;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_DOCTOR_DATA',
          message: 'The email or medical license number is already registered',
        });
      }

      throw error;
    }
  }

  async findAll(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    return this.prisma.doctor.findMany({
      where: { user: { hospitalId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        departmentId: true,
        licenseNumber: true,
        specialization: true,
        qualification: true,
        experienceYears: true,
        consultationFee: true,
        bio: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            emailVerifiedAt: true,
          },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      select: {
        id: true,
        departmentId: true,
        licenseNumber: true,
        specialization: true,
        qualification: true,
        experienceYears: true,
        consultationFee: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            isActive: true,
            emailVerifiedAt: true,
            hospitalId: true,
          },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId,
          hospitalId: doctor.user.hospitalId ?? undefined,
          isActive: true,
        },
      });

      if (!department) {
        throw new BadRequestException({
          code: 'INVALID_DEPARTMENT',
          message: 'Department is inactive or belongs to another hospital',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: doctor.userId },
        data: {
          ...(dto.firstName !== undefined && {
            firstName: dto.firstName.trim(),
          }),
          ...(dto.lastName !== undefined && {
            lastName: dto.lastName.trim(),
          }),
          ...(dto.phone !== undefined && {
            phone: dto.phone.trim() || null,
          }),
        },
      });

      return tx.doctor.update({
        where: { id },
        data: {
          ...(dto.specialization !== undefined && {
            specialization: dto.specialization.trim(),
          }),
          ...(dto.qualification !== undefined && {
            qualification: dto.qualification.trim() || null,
          }),
          ...(dto.experienceYears !== undefined && {
            experienceYears: dto.experienceYears,
          }),
          ...(dto.consultationFee !== undefined && {
            consultationFee: dto.consultationFee,
          }),
          ...(dto.bio !== undefined && { bio: dto.bio.trim() || null }),
          ...(dto.departmentId !== undefined && {
            departmentId: dto.departmentId || null,
          }),
        },
        select: {
          id: true,
          departmentId: true,
          licenseNumber: true,
          specialization: true,
          qualification: true,
          experienceYears: true,
          consultationFee: true,
          bio: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
            },
          },
        },
      });
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.user.update({
      where: { id: doctor.userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }
}