import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Req,
  UseGuards,
  Query,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { HospitalDashboardService } from './hospital-dashboard.service.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    role: string;
  };
};

@Controller('hospital-dashboard')
@ApiTags('Hospital Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HOSPITAL_ADMIN')
export class HospitalDashboardController {
  constructor(
    private readonly dashboardService: HospitalDashboardService,
  ) {}

  @Get('overview')
  async getOverview(@Req() req: AuthenticatedRequest) {
    const data = await this.dashboardService.getOverview(
      req.user.userId,
    );

    return {
      success: true,
      message: 'Hospital dashboard overview fetched successfully',
      data,
    };
  }

  @Get('appointments')
    async getAppointments(
    @Req() req: AuthenticatedRequest,
    @Query() query: {
        page?: string;
        limit?: string;
        status?: string;
        fromDate?: string;
        toDate?: string;
        search?: string;
    },
    ) {
    const data = await this.dashboardService.getAppointments(
        req.user.userId,
        query,
    );

    return {
        success: true,
        message: 'Hospital appointments fetched successfully',
        data,
    };
    }

    @Get('appointments/:id')
    async getAppointmentById(
    @Req() req: AuthenticatedRequest,
    @Param('id') appointmentId: string,
    ) {
    const data = await this.dashboardService.getAppointmentById(
        req.user.userId,
        appointmentId,
    );

    return {
        success: true,
        message: 'Appointment details fetched successfully',
        data,
    };
    }

    @Get('patients')
    async getPatients(
    @Req() req: AuthenticatedRequest,
    @Query()
    query: {
        page?: string;
        limit?: string;
        search?: string;
    },
    ) {
    const data = await this.dashboardService.getPatients(
        req.user.userId,
        query,
    );

    return {
        success: true,
        message: 'Hospital patients fetched successfully',
        data,
    };
    }

    @Get('patients/:id')
    async getPatientById(
    @Req() req: AuthenticatedRequest,
    @Param('id') patientId: string,
    ) {
    const data = await this.dashboardService.getPatientById(
        req.user.userId,
        patientId,
    );

    return {
        success: true,
        message: 'Patient details fetched successfully',
        data,
    };
    }

    @Get('patients/:id/appointments')
    async getPatientAppointments(
    @Req() req: AuthenticatedRequest,
    @Param('id') patientId: string,
    @Query()
    query: {
        page?: string;
        limit?: string;
        status?: string;
    },
    ) {
    const data = await this.dashboardService.getPatientAppointments(
        req.user.userId,
        patientId,
        query,
    );

    return {
        success: true,
        message: 'Patient appointments fetched successfully',
        data,
    };
    }

    @Get('patients/:id/medical-records')
    async getPatientMedicalRecords(
    @Req() req: AuthenticatedRequest,
    @Param('id') patientId: string,
    @Query()
    query: {
    page?: string;
    limit?: string;
    },
    ) {
    const data = await this.dashboardService.getPatientMedicalRecords(
    req.user.userId,
    patientId,
    query,
    );

    return {
    success: true,
    message: 'Patient medical records fetched successfully',
    data,
    };
    }
}