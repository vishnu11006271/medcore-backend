
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hospitalId: string, dto: CreateDepartmentDto) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, status: true },
    });

    if (!hospital) {
      throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'Hospital not found.',
      });
    }

    if (hospital.status !== 'VERIFIED') {
      throw new BadRequestException({
        code: 'HOSPITAL_NOT_VERIFIED',
        message: 'Departments can only be added to verified hospitals.',
      });
    }

    try {
      return await this.prisma.department.create({
        data: {
          hospitalId,
          name: dto.name.trim(),
          code: dto.code?.trim() || null,
          description: dto.description?.trim() || null,
        },
        select: {
          id: true,
          hospitalId: true,
          name: true,
          code: true,
          description: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'DEPARTMENT_ALREADY_EXISTS',
          message: 'The department name or code already exists in this hospital.',
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
      throw new NotFoundException({
        code: 'HOSPITAL_NOT_FOUND',
        message: 'Hospital not found.',
      });
    }

    return this.prisma.department.findMany({
      where: { hospitalId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        hospitalId: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'Department not found.',
      });
    }

    try {
      return await this.prisma.department.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.code !== undefined && {
            code: dto.code.trim() || null,
          }),
          ...(dto.description !== undefined && {
            description: dto.description.trim() || null,
          }),
          ...(dto.isActive !== undefined && {
            isActive: dto.isActive,
          }),
        },
        select: {
          id: true,
          hospitalId: true,
          name: true,
          code: true,
          description: true,
          isActive: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'DEPARTMENT_ALREADY_EXISTS',
          message: 'The department name or code already exists in this hospital.',
        });
      }
      throw error;
    }
  }

  async deactivate(id: string) {
    const existing = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'Department not found.',
      });
    }

    if (!existing.isActive) {
      throw new BadRequestException({
        code: 'DEPARTMENT_ALREADY_INACTIVE',
        message: 'This department is already inactive.',
      });
    }

    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        hospitalId: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
