
import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    role: string;
  };
};

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
  ) {}

  // Existing booking endpoint — behavior remains unchanged.
  @Post()
  @Roles('PATIENT')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAppointmentDto,
  ) {
    const data =
      await this.appointmentsService.createAppointment(
        req.user.userId,
        dto,
      );

    return {
      success: true,
      data,
      message: 'Appointment booked successfully',
    };
  }

  @Patch(':id/confirm')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST')
  async confirm(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data =
      await this.appointmentsService.changeAppointmentStatus(
        id,
        req.user.userId,
        req.user.role,
        'confirm',
      );

    return {
      success: true,
      data,
      message: 'Appointment confirmed successfully',
    };
  }

  @Patch(':id/start')
  @Roles('DOCTOR', 'HOSPITAL_ADMIN', 'RECEPTIONIST')
  async start(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data =
      await this.appointmentsService.changeAppointmentStatus(
        id,
        req.user.userId,
        req.user.role,
        'start',
      );

    return {
      success: true,
      data,
      message: 'Appointment started successfully',
    };
  }

  @Patch(':id/complete')
  @Roles('DOCTOR', 'HOSPITAL_ADMIN', 'RECEPTIONIST')
  async complete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data =
      await this.appointmentsService.changeAppointmentStatus(
        id,
        req.user.userId,
        req.user.role,
        'complete',
      );

    return {
      success: true,
      data,
      message: 'Appointment completed successfully',
    };
  }

  @Patch(':id/cancel')
  @Roles('PATIENT', 'HOSPITAL_ADMIN', 'RECEPTIONIST')
  async cancel(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data =
      await this.appointmentsService.changeAppointmentStatus(
        id,
        req.user.userId,
        req.user.role,
        'cancel',
      );

    return {
      success: true,
      data,
      message: 'Appointment cancelled successfully',
    };
  }

  @Get('my')
  @Roles('PATIENT')
  async getMyAppointments(
    @Req() req: AuthenticatedRequest,
  ) {
    const data =
      await this.appointmentsService.getMyAppointments(
        req.user.userId,
      );

    return {
      success: true,
      data,
      message: 'Appointments retrieved successfully',
    };
  }

  @Get(':id')
  @Roles('PATIENT')
  async getAppointmentById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data =
      await this.appointmentsService.getAppointmentById(
        id,
        req.user.userId,
      );

    return {
      success: true,
      data,
      message: 'Appointment details retrieved successfully',
    };
  }

  @Get('doctor/my')
  @Roles('DOCTOR')
  async getDoctorAppointments(
    @Req() req: AuthenticatedRequest,
  ) {
    const data =
      await this.appointmentsService.getDoctorAppointments(
        req.user.userId,
      );

    return {
      success: true,
      data,
      message: 'Doctor appointments retrieved successfully',
    };
  }

  @Get('doctor/my-patients')
  @Roles('DOCTOR')
  async getDoctorPatients(@Req() req: AuthenticatedRequest) {
    const data = await this.appointmentsService.getDoctorPatients(
      req.user.userId,
    );

    return {
      success: true,
      data,
      message: 'Doctor patients retrieved successfully',
    };
  }


  @Get('doctor/my-patients/:patientId')
  @Roles('DOCTOR')
  async getDoctorPatientDetails(
    @Req() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
  ) {
    const data = await this.appointmentsService.getDoctorPatientDetails(
      req.user.userId,
      patientId,
    );

    return {
      success: true,
      data,
      message: 'Doctor patient details retrieved successfully',
    };
  }

}
