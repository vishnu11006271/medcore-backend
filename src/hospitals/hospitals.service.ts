
import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateHospitalDto } from './dto/create-hospital.dto.js';

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
