import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { CreateStaffDto, STAFF_ROLES } from './dto/create-staff.dto.js';

export interface StaffActor {
  userId: string;
  role: string;
  hospitalId: string | null;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private assertHospitalAdmin(actor: StaffActor): string {
    if (actor.role !== 'HOSPITAL_ADMIN' || !actor.hospitalId) {
      throw new ForbiddenException({
        code: 'HOSPITAL_SCOPE_REQUIRED',
        message: 'A hospital administrator account is required.',
      });
    }
    return actor.hospitalId;
  }

  async create(dto: CreateStaffDto, actor: StaffActor) {
    const hospitalId = this.assertHospitalAdmin(actor);
    const email = dto.email.trim().toLowerCase();

    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, status: true },
    });
    if (!hospital || hospital.status !== 'VERIFIED') {
      throw new BadRequestException({
        code: 'HOSPITAL_NOT_VERIFIED',
        message: 'Staff can only be added to a verified hospital.',
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists.',
      });
    }

    if (!(STAFF_ROLES as readonly string[]).includes(dto.role)) {
      throw new BadRequestException({
        code: 'INVALID_STAFF_ROLE',
        message: 'The selected role cannot be created through staff onboarding.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const otp = randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null,
          role: dto.role,
          hospitalId,
          isActive: true,
          emailVerifiedAt: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          hospitalId: true,
          isActive: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });

      const otpRecord = await tx.emailOtp.create({
        data: {
          userId: user.id,
          email,
          codeHash,
          purpose: 'EMAIL_VERIFICATION',
          expiresAt,
        },
        select: { id: true },
      });

      return { user, otpId: otpRecord.id };
    });

    try {
      await this.mailService.sendVerificationOtp(email, dto.firstName.trim(), otp);
    } catch (error) {
      await this.prisma.emailOtp.updateMany({
        where: { id: created.otpId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw error;
    }

    return {
      user: created.user,
      otpExpiresAt: expiresAt,
    };
  }

  async findAll(actor: StaffActor) {
    const hospitalId = this.assertHospitalAdmin(actor);
    return this.prisma.user.findMany({
      where: {
        hospitalId,
        role: { in: [...STAFF_ROLES] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
  }

  async updateStatus(userId: string, isActive: boolean, actor: StaffActor) {
    const hospitalId = this.assertHospitalAdmin(actor);
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        hospitalId,
        role: { in: [...STAFF_ROLES] },
      },
      data: { isActive },
    });

    if (result.count !== 1) {
      throw new NotFoundException({
        code: 'STAFF_MEMBER_NOT_FOUND',
        message: 'Staff member was not found in your hospital.',
      });
    }

    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    });
  }
}
