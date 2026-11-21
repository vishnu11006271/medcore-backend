import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import {
  DoctorsService,
  type DoctorActor,
} from './doctors.service.js';

import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { UpdateDoctorDto } from './dto/update-doctor.dto.js';
import { UpdateDoctorStatusDto } from './dto/update-doctor-status.dto.js';

interface AuthenticatedRequest extends Request {
  user: DoctorActor;
}

@Controller()
@ApiTags('Doctors')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  // Create a doctor
  @Post('hospitals/:hospitalId/doctors')
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateDoctorDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.doctorsService.create(
      hospitalId,
      dto,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Doctor created successfully. Email verification is required.',
    };
  }

  // Get all doctors belonging to a hospital
  // Get doctors belonging to a hospital
  @Get('hospitals/:hospitalId/doctors')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PATIENT')
  async findAll(
    @Param('hospitalId') hospitalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.doctorsService.findAll(
      hospitalId,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Doctors retrieved successfully',
    };
  }

  // Get doctor details
  @Get('doctors/:id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.doctorsService.findOne(
      id,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Doctor retrieved successfully',
    };
  }

  // Update doctor details
  @Patch('doctors/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.doctorsService.update(
      id,
      dto,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Doctor updated successfully',
    };
  }

  // Activate or deactivate doctor
  @Patch('doctors/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.doctorsService.updateStatus(
      id,
      dto.isActive,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Doctor account status updated successfully',
    };
  }
}
