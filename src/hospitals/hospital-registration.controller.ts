
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { HospitalsService } from './hospitals.service.js';
import { RegisterHospitalDto } from './dto/register-hospital.dto.js';

@Controller('hospitals')
export class HospitalRegistrationController {
  constructor(
    private readonly hospitalsService: HospitalsService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterHospitalDto) {
    const data = await this.hospitalsService.registerHospital(dto);

    return {
      success: true,
      data,
      message: 'Hospital registration submitted successfully.',
    };
  }
}
