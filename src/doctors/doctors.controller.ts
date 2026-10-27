import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { DoctorsService } from './doctors.service.js';
import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { UpdateDoctorDto } from './dto/update-doctor.dto.js';
import { UpdateDoctorStatusDto } from './dto/update-doctor-status.dto.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post('hospitals/:hospitalId/doctors')
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateDoctorDto,
  ) {
    const data = await this.doctorsService.create(hospitalId, dto);

    return {
      success: true,
      data,
      message: 'Doctor created successfully. Email verification is required.',
    };
  }

  @Get('hospitals/:hospitalId/doctors')
  async findAll(@Param('hospitalId') hospitalId: string) {
    const data = await this.doctorsService.findAll(hospitalId);

    return {
      success: true,
      data,
      message: 'Doctors retrieved successfully',
    };
  }

  @Get('doctors/:id')
  async findOne(@Param('id') id: string) {
    const data = await this.doctorsService.findOne(id);

    return {
      success: true,
      data,
      message: 'Doctor retrieved successfully',
    };
  }

  @Patch('doctors/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    const data = await this.doctorsService.update(id, dto);

    return {
      success: true,
      data,
      message: 'Doctor updated successfully',
    };
  }

  @Patch('doctors/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorStatusDto,
  ) {
    const data = await this.doctorsService.updateStatus(
      id,
      dto.isActive,
    );

    return {
      success: true,
      data,
      message: 'Doctor account status updated successfully',
    };
  }
}