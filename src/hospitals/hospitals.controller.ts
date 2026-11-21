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

import { HospitalsService } from './hospitals.service.js';
import { CreateHospitalDto } from './dto/create-hospital.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    role: string;
    hospitalId: string | null;
  };
};

@Controller('hospitals')
@ApiTags('Hospitals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalsController {
  constructor(
    private readonly hospitalsService: HospitalsService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Body() dto: CreateHospitalDto) {
    const hospital = await this.hospitalsService.create(dto);

    return {
      success: true,
      data: hospital,
      message: 'Hospital created successfully.',
    };
  }

  @Get()
  @Roles('SUPER_ADMIN')
  async findAll() {
    const hospitals = await this.hospitalsService.findAll();

    return {
      success: true,
      data: hospitals,
      message: 'Hospitals retrieved successfully.',
    };
  }

  // Patient-facing endpoint for appointment booking
  @Get('verified')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PATIENT')
  async findVerified() {
    const hospitals = await this.hospitalsService.findVerified();

    return {
      success: true,
      data: hospitals,
      message: 'Verified hospitals retrieved successfully.',
    };
  }

  @Patch(':id/verify')
  @Roles('SUPER_ADMIN')
  async verify(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const hospital = await this.hospitalsService.verify(
      id,
      req.user.userId,
    );

    return {
      success: true,
      data: hospital,
      message: 'Hospital verified successfully.',
    };
  }


  @Patch(':id/reject')
  @Roles('SUPER_ADMIN')
  async reject(@Param('id') id: string) {
    const hospital = await this.hospitalsService.reject(id);

    return {
      success: true,
      data: hospital,
      message: 'Hospital rejected successfully.',
    };
  }

}
