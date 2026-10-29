
import {
  Body,
  Controller,
  Post,
  Req,
  Get,
  Patch,
  Param,
  UseGuards,
  Query
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { MedicalRecordHistoryQueryDto } from './dto/medical-record-history-query.dto.js';

import { CreateMedicalRecordDto } from './dto/create-medical-record.dto.js';
import { MedicalRecordsService } from './medical-records.service.js';
import { CreateVitalSignDto } from './dto/create-vital-sign.dto.js';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    role: string;
  };
};

@Controller('medical-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  @Post()
  @Roles('DOCTOR')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMedicalRecordDto,
  ) {
    const data = await this.medicalRecordsService.create(
      req.user.userId,
      dto,
    );

    return {
      success: true,
      data,
      message: 'Medical record created successfully',
    };
  }

  @Get('my-history')
    @Roles('PATIENT')
    async findMyHistory(
    @Req() req: AuthenticatedRequest,
    @Query() query: MedicalRecordHistoryQueryDto,
    ) {
    const result = await this.medicalRecordsService.findMyHistory(
        req.user.userId,
        query.page,
        query.limit,
    );

    return {
        success: true,
        data: result.data,
        meta: result.meta,
        message: 'Medical record history fetched successfully',
    };
    }


    @Get(':id')
    @Roles('DOCTOR')
    async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    ) {
    const data = await this.medicalRecordsService.findOne(
    req.user.userId,
    id,
    );

    return {
    success: true,
    data,
    message: 'Medical record fetched successfully',
    };
    }


    @Patch(':id/finalize')
    @Roles('DOCTOR')
    async finalize(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    ) {
    const data = await this.medicalRecordsService.finalize(
        req.user.userId,
        id,
    );

    return {
        success: true,
        data,
        message: 'Medical record finalized successfully',
    };
    }

    
    @Post(':id/vitals')
    @Roles('DOCTOR')
    async addVitals(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateVitalSignDto,
    ) {
    const data = await this.medicalRecordsService.addVitals(
        req.user.userId,
        id,
        dto,
    );

    return {
        success: true,
        data,
        message: 'Vitals recorded successfully',
    };
    }

    @Get(':id/vitals')
    @Roles('DOCTOR')
    async findVitals(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    ) {
    const data = await this.medicalRecordsService.findVitals(
        req.user.userId,
        id,
    );

    return {
        success: true,
        data,
        message: 'Vitals fetched successfully',
    };
    }

    
    @Patch(':id')
    @Roles('DOCTOR')
    async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMedicalRecordDto,
    ) {
    const data = await this.medicalRecordsService.update(
        req.user.userId,
        id,
        dto,
    );

    return {
        success: true,
        data,
        message: 'Medical record updated successfully',
    };
    }



}
