
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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { LaboratoryService } from './laboratory.service.js';

import { CreateLabTestDto } from './dto/create-lab-test.dto.js';
import { UpdateLabTestDto } from './dto/update-lab-test.dto.js';
import { CreateLabOrderDto } from './dto/create-lab-order.dto.js';
import { UploadLabResultDto } from './dto/upload-lab-result.dto.js';
import { ApproveLabResultDto } from './dto/approve-lab-result.dto.js';

@Controller('lab')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaboratoryController {
  constructor(
    private readonly laboratoryService: LaboratoryService,
  ) {}

  // --------------------------------------------------
  // LAB TEST MANAGEMENT
  // --------------------------------------------------

  @Post('tests')
  @Roles('HOSPITAL_ADMIN')
  async createLabTest(
    @Req() req: any,
    @Body() dto: CreateLabTestDto,
  ) {
    const result = await this.laboratoryService.createLabTest(
      req.user.userId,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory test created successfully',
    };
  }

  @Get('tests')
  @Roles(
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'LAB_TECHNICIAN',
    'NURSE',
    'RECEPTIONIST',
  )
  async findLabTests(@Req() req: any) {
    const result = await this.laboratoryService.findLabTests(
      req.user.userId,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory tests fetched successfully',
    };
  }

  @Patch('tests/:id')
  @Roles('HOSPITAL_ADMIN')
  async updateLabTest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLabTestDto,
  ) {
    const result = await this.laboratoryService.updateLabTest(
      req.user.userId,
      id,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory test updated successfully',
    };
  }

  // --------------------------------------------------
  // DOCTOR: LAB ORDERS
  // --------------------------------------------------

  @Post('orders')
  @Roles('DOCTOR')
  async createLabOrder(
    @Req() req: any,
    @Body() dto: CreateLabOrderDto,
  ) {
    const result = await this.laboratoryService.createLabOrder(
      req.user.userId,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory order created successfully',
    };
  }

  @Get('orders')
  @Roles('DOCTOR', 'LAB_TECHNICIAN')
  async findOrders(@Req() req: any) {
    const result = await this.laboratoryService.findOrders(
      req.user.userId,
      req.user.role,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory orders fetched successfully',
    };
  }

  @Get('orders/:id')
  @Roles('DOCTOR', 'LAB_TECHNICIAN')
  async findOrder(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const result = await this.laboratoryService.findOrder(
      req.user.userId,
      req.user.role,
      id,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory order fetched successfully',
    };
  }

  // --------------------------------------------------
  // LAB TECHNICIAN: ORDER WORKFLOW
  // --------------------------------------------------

  @Patch('orders/:id/collect-sample')
  @Roles('LAB_TECHNICIAN')
  async collectSample(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const result = await this.laboratoryService.collectSample(
      req.user.userId,
      id,
    );

    return {
      success: true,
      data: result,
      message: 'Sample collected successfully',
    };
  }

  @Patch('orders/:id/start-processing')
  @Roles('LAB_TECHNICIAN')
  async startProcessing(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const result = await this.laboratoryService.startProcessing(
      req.user.userId,
      id,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory processing started',
    };
  }

  @Patch('orders/:id/upload-result')
  @Roles('LAB_TECHNICIAN')
  async uploadResult(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UploadLabResultDto,
  ) {
    const result = await this.laboratoryService.uploadResult(
      req.user.userId,
      id,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory result uploaded successfully',
    };
  }

  // --------------------------------------------------
  // DOCTOR: APPROVE RESULT
  // --------------------------------------------------

  @Patch('orders/:id/approve')
  @Roles('DOCTOR')
  async approveResult(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveLabResultDto,
  ) {
    const result = await this.laboratoryService.approveResult(
      req.user.userId,
      id,
      dto,
    );

    return {
      success: true,
      data: result,
      message: 'Laboratory result approved successfully',
    };
  }

  // --------------------------------------------------
  // PATIENT: VIEW APPROVED RESULTS
  // --------------------------------------------------

  @Get('patient/results')
  @Roles('PATIENT')
  async findPatientResults(@Req() req: any) {
    const result = await this.laboratoryService.findPatientResults(
      req.user.userId,
    );

    return {
      success: true,
      data: result,
      message: 'Patient laboratory results fetched successfully',
    };
  }
}
