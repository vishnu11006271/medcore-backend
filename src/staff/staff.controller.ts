import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto.js';
import { StaffActor, StaffService } from './staff.service.js';

type StaffRequest = Request & { user: StaffActor };

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HOSPITAL_ADMIN')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  async create(@Body() dto: CreateStaffDto, @Req() req: StaffRequest) {
    const data = await this.staffService.create(dto, req.user);
    return {
      success: true,
      data,
      message: 'Staff account created. Email verification is required.',
    };
  }

  @Get()
  async findAll(@Req() req: StaffRequest) {
    const data = await this.staffService.findAll(req.user);
    return { success: true, data, message: 'Staff members retrieved successfully.' };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
    @Req() req: StaffRequest,
  ) {
    const data = await this.staffService.updateStatus(id, dto.isActive, req.user);
    return { success: true, data, message: 'Staff status updated successfully.' };
  }
}
