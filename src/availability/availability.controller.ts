import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { AvailabilityService, } from './availability.service.js';
import type { AvailabilityActor } from './availability.service.js';

import { WeeklyAvailabilityDto } from './dto/weekly-availability.dto.js';

interface AuthenticatedRequest extends Request {
  user: AvailabilityActor;
}

@Controller('doctors/:doctorId/availability')
@ApiTags('Doctor Availability')
@ApiBearerAuth('access-token')
@ApiTags('Doctor Availability')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Put()
  async setWeeklySchedule(
    @Param('doctorId') doctorId: string,
    @Body() dto: WeeklyAvailabilityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.availabilityService.setWeeklySchedule(
      doctorId,
      dto,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Weekly availability saved successfully',
    };
  }

  @Get()
  async getWeeklySchedule(
    @Param('doctorId') doctorId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.availabilityService.getWeeklySchedule(
      doctorId,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Weekly availability retrieved successfully',
    };
  }

  @Get('slots')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PATIENT')
  async getAvailableSlots(
    @Param('doctorId') doctorId: string,
    @Query() query: AvailableSlotsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.availabilityService.getAvailableSlots(
      doctorId,
      query.date,
      req.user,
    );

    return {
      success: true,
      data,
      message: 'Available slots retrieved successfully',
    };
  }
}