
import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateHospitalDto } from './dto/create-hospital.dto.js';

import { randomInt, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { UserRole, OtpPurpose } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { RegisterHospitalDto } from './dto/register-hospital.dto.js';

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService, private readonly mailService: MailService,) {}

  async create(dto: CreateHospitalDto) {
    try {
      return await this.prisma.hospital.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug,
          email: dto.email.trim().toLowerCase(),
          registrationNumber: dto.registrationNumber?.trim(),
          phone: dto.phone?.trim(),
          address: dto.address?.trim(),
          // status defaults to PENDING in Prisma.
        },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          registrationNumber: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'HOSPITAL_ALREADY_EXISTS',
          message:
            'A hospital with this slug or registration number already exists.',
        });
      }

      throw error;
    }
  }

  async findAll() {
    return this.prisma.hospital.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        registrationNumber: true,
        phone: true,
        address: true,
        status: true,
        verifiedAt: true,
        verifiedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async verify(id: string, verifiedById: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!hospital) {
      throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'Hospital not found.',
      });
    }

    if (hospital.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'INVALID_HOSPITAL_STATUS',
        message: 'Only pending hospitals can be verified.',
      });
    }

    return this.prisma.hospital.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedById,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        status: true,
        verifiedAt: true,
        verifiedById: true,
        updatedAt: true,
      },
    });
  }

  
  async findVerified() {
    return this.prisma.hospital.findMany({
      where: {
        status: 'VERIFIED',
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });
  }


  async registerHospital(dto: RegisterHospitalDto) {
    const adminEmail = dto.adminEmail.toLowerCase().trim();
    const hospitalEmail = dto.hospitalEmail.toLowerCase().trim();
    const slug = dto.slug.toLowerCase().trim();

    // Check whether the admin email is already registered.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this admin email already exists.',
      });
    }

    // Check whether the hospital slug is already used.
    const existingHospital = await this.prisma.hospital.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingHospital) {
      throw new ConflictException({
        code: 'HOSPITAL_SLUG_EXISTS',
        message: 'A hospital with this slug already exists.',
      });
    }

    if (dto.registrationNumber) {
      const existingRegistration = await this.prisma.hospital.findUnique({
        where: {
          registrationNumber: dto.registrationNumber.trim(),
        },
        select: { id: true },
      });

      if (existingRegistration) {
        throw new ConflictException({
          code: 'REGISTRATION_NUMBER_EXISTS',
          message: 'This hospital registration number is already registered.',
        });
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Generate a six-digit email verification OTP.
    const otp = randomInt(100000, 1000000).toString();

    // Store only the hash of the OTP.
    const codeHash = createHash('sha256').update(otp).digest('hex');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.create({
        data: {
          name: dto.hospitalName.trim(),
          slug,
          email: hospitalEmail,
          registrationNumber: dto.registrationNumber?.trim(),
          phone: dto.hospitalPhone?.trim(),
          address: dto.address?.trim(),
          status: 'PENDING',
        },
      });

      const admin = await tx.user.create({
        data: {
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          email: adminEmail,
          phone: dto.adminPhone?.trim(),
          passwordHash,
          role: UserRole.HOSPITAL_ADMIN,
          hospitalId: hospital.id,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          hospitalId: true,
        },
      });

      await tx.emailOtp.create({
        data: {
          userId: admin.id,
          email: adminEmail,
          codeHash,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          expiresAt,
          attempts: 0,
        },
      });

      return { hospital, admin };
    });

    // Send email only after the transaction has committed.
    try {
      await this.mailService.sendVerificationOtp(
        adminEmail,
        dto.adminFirstName.trim(),
        otp,
      );
    } catch (error) {
      // Invalidate the OTP if email delivery fails.
      await this.prisma.emailOtp.updateMany({
        where: {
          userId: result.admin.id,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      });

      throw error;
    }

    return {
      hospital: {
        id: result.hospital.id,
        name: result.hospital.name,
        slug: result.hospital.slug,
        email: result.hospital.email,
        status: result.hospital.status,
      },
      admin: result.admin,
      message:
        'Hospital registration submitted. Verify the admin email and wait for Super Admin approval.',
    };
  }


  async reject(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!hospital) {
      throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'Hospital not found.',
      });
    }

    if (hospital.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'INVALID_HOSPITAL_STATUS',
        message: 'Only pending hospitals can be rejected.',
      });
    }

    return this.prisma.hospital.update({
      where: { id },
      data: {
        status: 'REJECTED',
      },
    });
  }



}
