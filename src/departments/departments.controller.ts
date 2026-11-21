import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
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

import { DepartmentsService } from './departments.service.js';
import type { DepartmentActor } from './departments.service.js';

import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { UpdateDepartmentStatusDto } from './dto/update-department-status.dto.js';

type AuthenticatedRequest = Request & {
  user: DepartmentActor;
};

@Controller()
@ApiTags('Departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN')
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
  ) {}

  @Post('hospitals/:hospitalId/departments')
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateDepartmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const department = await this.departmentsService.create(
      hospitalId,
      dto,
      req.user,
    );

    return {
      success: true,
      data: department,
      message: 'Department created successfully.',
    };
  }

  @Get('hospitals/:hospitalId/departments')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PATIENT')
  async findAll(
    @Param('hospitalId') hospitalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const departments = await this.departmentsService.findAll(
      hospitalId,
      req.user,
    );

    return {
      success: true,
      data: departments,
      message: 'Departments retrieved successfully.',
    };
  }

  @Patch('departments/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const department = await this.departmentsService.update(
      id,
      dto,
      req.user,
    );

    return {
      success: true,
      data: department,
      message: 'Department updated successfully.',
    };
  }

  @Delete('departments/:id')
  async deactivate(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const department = await this.departmentsService.deactivate(
      id,
      req.user,
    );

    return {
      success: true,
      data: department,
      message: 'Department deactivated successfully.',
    };
  }

  @Patch('departments/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const department = await this.departmentsService.updateStatus(
      id,
      dto.isActive,
      req.user,
    );

    return {
      success: true,
      data: department,
      message: `Department ${dto.isActive ? 'activated' : 'deactivated'} successfully.`,
    };
  }
}