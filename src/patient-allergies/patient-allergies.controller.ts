
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

import { PatientAllergiesService } from './patient-allergies.service.js';
import { CreatePatientAllergyDto } from './dto/create-patient-allergy.dto.js';
import { UpdatePatientAllergyDto } from './dto/update-patient-allergy.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

interface AuthenticatedRequest {
  user: {
    userId: string;
  };
}

@Controller('patient-allergies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class PatientAllergiesController {
  constructor(
    private readonly patientAllergiesService: PatientAllergiesService,
  ) {}

  // POST /patient-allergies
  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePatientAllergyDto,
  ) {
    return this.patientAllergiesService.create(
      req.user.userId,
      dto,
    );
  }

  // GET /patient-allergies/patient/:patientId
  @Get('patient/:patientId')
  findAll(
    @Req() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
  ) {
    return this.patientAllergiesService.findAll(
      req.user.userId,
      patientId,
    );
  }

  // PATCH /patient-allergies/:id
  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') allergyId: string,
    @Body() dto: UpdatePatientAllergyDto,
  ) {
    return this.patientAllergiesService.update(
      req.user.userId,
      allergyId,
      dto,
    );
  }

  // PATCH /patient-allergies/:id/deactivate
  @Patch(':id/deactivate')
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('id') allergyId: string,
  ) {
    return this.patientAllergiesService.deactivate(
      req.user.userId,
      allergyId,
    );
  }
}
