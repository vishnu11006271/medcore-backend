import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateAppointmentDto,
  ) {
    const authUser = req.user as { userId: string };

    const data =
      await this.appointmentsService.createAppointment(
        authUser.userId,
        dto,
      );

    return {
      success: true,
      data,
      message: 'Appointment booked successfully',
    };
  }
}
