import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  Query,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { PrescriptionsService } from './prescriptions.service.js';
import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

  @Post()
  @Roles('DOCTOR')
  async create(
    @Req() req: any,
    @Body() dto: CreatePrescriptionDto,
  ) {
    const prescription = await this.prescriptionsService.create(
      req.user.userId,
      dto,
    );

    return {
      success: true,
      data: prescription,
      message: 'Prescription created successfully',
    };
  }

  @Get('my')
  @Roles('PATIENT')
  async findMyPrescriptions(@Req() req: any) {
    const prescriptions =
      await this.prescriptionsService.findMyPrescriptions(
        req.user.userId,
      );

    return {
      success: true,
      data: prescriptions,
      message: 'Patient prescriptions fetched successfully',
    };
  }

  
    @Get('medicines/search')
    @Roles('DOCTOR')
    async searchMedicines(
    @Req() req: any,
    @Query('q') query: string,
    ) {
    const medicines =
        await this.prescriptionsService.searchMedicines(
        req.user.userId,
        query ?? '',
        );

    return {
        success: true,
        data: medicines,
        message: 'Medicines fetched successfully',
    };
    }


    @Get(':id/pdf')
    @Roles('DOCTOR', 'PATIENT')
    async exportPdf(
    @Req() req: any,
    @Param('id') prescriptionId: string,
    ) {
    const buffer = await this.prescriptionsService.exportPdf(
        req.user.userId,
        req.user.role,
        prescriptionId,
    );

    return new StreamableFile(buffer, {
        type: 'application/pdf',
        disposition:
        `attachment; filename="prescription-${prescriptionId}.pdf"`,
    });
    }

}