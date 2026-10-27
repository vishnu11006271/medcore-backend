
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
  ) {}

  @Post('hospitals/:hospitalId/departments')
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    const department = await this.departmentsService.create(
      hospitalId,
      dto,
    );

    return {
      success: true,
      data: department,
      message: 'Department created successfully.',
    };
  }

  @Get('hospitals/:hospitalId/departments')
  async findAll(@Param('hospitalId') hospitalId: string) {
    const departments =
      await this.departmentsService.findAll(hospitalId);

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
  ) {
    const department = await this.departmentsService.update(
      id,
      dto,
    );

    return {
      success: true,
      data: department,
      message: 'Department updated successfully.',
    };
  }

  @Delete('departments/:id')
  async deactivate(@Param('id') id: string) {
    const department = await this.departmentsService.deactivate(id);

    return {
      success: true,
      data: department,
      message: 'Department deactivated successfully.',
    };
  }
}
