import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { createHash, randomBytes } from 'crypto';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Use the same error for an unknown email and a wrong password.
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches || !user.isActive) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const refresh = await this.saveRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hospitalId: user.hospitalId,
        emailVerifiedAt: user.emailVerifiedAt,
        refreshToken: refresh.token,
        refreshTokenExpiresAt: refresh.expiresAt,
      },
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    // Do not create duplicate accounts.
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      });
    }

    // Never store a plain-text password.
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Generate a cryptographically secure six-digit OTP.
    const otp = randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // const result = await this.prisma.$transaction(async (tx) => {
    //   const user = await tx.user.create({
    //     data: {
    //       email,
    //       firstName: dto.firstName.trim(),
    //       lastName: dto.lastName.trim(),
    //       passwordHash,
    //       role: 'PATIENT',
    //       isActive: true,
    //     },
    //     select: {
    //       id: true,
    //       email: true,
    //       firstName: true,
    //       lastName: true,
    //       role: true,
    //     },
    //   });

    //   await tx.emailOtp.create({
    //     data: {
    //       userId: user.id,
    //       email,
    //       codeHash,
    //       purpose: 'EMAIL_VERIFICATION',
    //       expiresAt,
    //     },
    //   });

    //   return user;
    // });
    const result = await this.prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.findUnique({
        where: { id: dto.hospitalId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!hospital || hospital.status !== 'VERIFIED') {
        throw new BadRequestException({
          code: 'INVALID_HOSPITAL',
          message: 'Please select a valid, verified hospital.',
        });
      }

      const user = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          role: 'PATIENT',
          isActive: true,
          hospitalId: hospital.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          hospitalId: hospital.id,
          patientNumber: `PAT-${randomUUID()}`,
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

      return {
        ...user,
        patientId: patient.id,
      };
    });

    // Temporary local development delivery.
    // Replace this with a real email provider before production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV EMAIL OTP] ${email}: ${otp}`);
    }

    return {
      user: result,
      otpExpiresAt: expiresAt,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.trim().toLowerCase();

    const otpRecord = await this.prisma.emailOtp.findFirst({
      where: {
        email,
        purpose: 'EMAIL_VERIFICATION',
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'The OTP is invalid or has expired.',
      });
    }

    if (otpRecord.attempts >= 5) {
      throw new BadRequestException({
        code: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many attempts. Request a new verification code.',
      });
    }

    if (otpRecord.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'The OTP is invalid or has expired.',
      });
    }

    const matches = await bcrypt.compare(dto.otp, otpRecord.codeHash);

    if (!matches) {
      await this.prisma.emailOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });

      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'The OTP is invalid or has expired.',
      });
    }

    if (!otpRecord.userId) {
      throw new BadRequestException({
        code: 'INVALID_OTP_RECORD',
        message: 'This verification code is not linked to a user.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.emailOtp.update({
        where: { id: otpRecord.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: otpRecord.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    return {
      email,
      emailVerified: true,
    };
  }

  
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private createRefreshTokenValue(): string {
    return randomBytes(64).toString('base64url');
  }

  private getRefreshTokenExpiry(): Date {
    const days = Number(
      this.configService.get('REFRESH_TOKEN_EXPIRES_DAYS') ?? 7,
    );

    if (!Number.isInteger(days) || days < 1 || days > 30) {
      throw new Error('Invalid refresh-token expiry configuration.');
    }

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async saveRefreshToken(userId: string) {
    const token = this.createRefreshTokenValue();
    const expiresAt = this.getRefreshTokenExpiry();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  
  async refreshSession(rawToken: string) {
    const tokenHash = this.hashRefreshToken(rawToken);
    const now = new Date();

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt <= now ||
      !existing.user.isActive ||
      !existing.user.emailVerifiedAt
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      });
    }

    // Generate a replacement token and rotate the old one atomically.
    const replacement = this.createRefreshTokenValue();
    const replacementExpiresAt = this.getRefreshTokenExpiry();
    const replacementHash = this.hashRefreshToken(replacement);

    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: existing.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token has already been used or revoked.',
        });
      }

      await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: replacementHash,
          expiresAt: replacementExpiresAt,
        },
      });
    });

    const user = existing.user;
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: replacement,
      refreshTokenExpiresAt: replacementExpiresAt,
    };
  }

  async logout(rawToken?: string) {
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash: this.hashRefreshToken(rawToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    return { loggedOut: true };
  }

  
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        hospitalId: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'User account was not found.',
      });
    }

    return user;
  }




}