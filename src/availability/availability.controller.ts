import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { AvailabilityService } from './availability.service.js';
import { WeeklyAvailabilityDto } from './dto/weekly-availability.dto.js';

@Controller('doctors/:doctorId/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Put()
  async setWeeklySchedule(
    @Param('doctorId') doctorId: string,
    @Body() dto: WeeklyAvailabilityDto,
  ) {
    const data =
      await this.availabilityService.setWeeklySchedule(
        doctorId,
        dto,
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
  ) {
    const data =
      await this.availabilityService.getWeeklySchedule(
        doctorId,
      );

    return {
      success: true,
      data,
      message: 'Weekly availability retrieved successfully',
    };
  }

  @Get('slots')
  async getAvailableSlots(
  @Param('doctorId') doctorId: string,
  @Query() query: AvailableSlotsQueryDto,
  ) {
    const data = await this.availabilityService.getAvailableSlots(
        doctorId,
        query.date,
    );

    return {
        success: true,
        data,
        message: 'Available slots retrieved successfully',
    };
  }
  
}