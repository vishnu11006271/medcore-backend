
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class HospitalsController {
  constructor(
    private readonly hospitalsService: HospitalsService,
  ) {}

  @Post()
  async create(@Body() dto: CreateHospitalDto) {
    const hospital = await this.hospitalsService.create(dto);

    return {
      success: true,
      data: hospital,
      message: 'Hospital created successfully.',
    };
  }

  @Get()
  async findAll() {
    const hospitals = await this.hospitalsService.findAll();

    return {
      success: true,
      data: hospitals,
      message: 'Hospitals retrieved successfully.',
    };
  }

  @Patch(':id/verify')
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
}
