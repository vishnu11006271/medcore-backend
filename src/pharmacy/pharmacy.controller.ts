import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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

import { PharmacyService } from './pharmacy.service.js';
import { CreateMedicineDto } from './dto/create-medicine.dto.js';
import { UpdateMedicineDto } from './dto/update-medicine.dto.js';
import { ReceiveStockDto } from './dto/receive-stock.dto.js';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('pharmacy')
@ApiTags('Pharmacy')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Post('medicines')
  @Roles('HOSPITAL_ADMIN')
  createMedicine(@Req() req: any, @Body() dto: CreateMedicineDto) {
    return this.pharmacyService.createMedicine(
      req.user.userId,
      req.user.hospitalId,
      dto,
    );
  }

  @Get('medicines')
  @Roles('HOSPITAL_ADMIN', 'PHARMACIST', 'DOCTOR')
  findAllMedicines(@Req() req: any) {
    return this.pharmacyService.findAllMedicines(req.user.hospitalId);
  }

  @Patch('medicines/:id')
  @Roles('HOSPITAL_ADMIN')
  updateMedicine(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMedicineDto,
  ) {
    return this.pharmacyService.updateMedicine(
      req.user.userId,
      req.user.hospitalId,
      id,
      dto,
    );
  }

  @Post('stock/receive')
  @Roles('HOSPITAL_ADMIN', 'PHARMACIST')
  receiveStock(@Req() req: any, @Body() dto: ReceiveStockDto) {
    return this.pharmacyService.receiveStock(
      req.user.userId,
      req.user.hospitalId,
      dto,
    );
  }

  @Get('medicines/:id/batches')
  @Roles('HOSPITAL_ADMIN', 'PHARMACIST')
  getMedicineBatches(@Req() req: any, @Param('id') id: string) {
    return this.pharmacyService.getMedicineBatches(
      req.user.hospitalId,
      id,
    );
  }

  @Post('dispense')
  @Roles('PHARMACIST')
  dispensePrescription(
    @Req() req: any,
    @Body() dto: DispensePrescriptionDto,
  ) {
    return this.pharmacyService.dispensePrescription(
      req.user.userId,
      req.user.hospitalId,
      dto,
    );
  }

  @Get('prescriptions/:id/dispensing-history')
  @Roles('HOSPITAL_ADMIN', 'PHARMACIST', 'DOCTOR')
  getPrescriptionDispensingHistory(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.pharmacyService.getPrescriptionDispensingHistory(
      req.user.hospitalId,
      id,
    );
  }

  @Get('prescriptions/active')
  @Roles('PHARMACIST', 'HOSPITAL_ADMIN')
  async getActivePrescriptions(@Req() req: any) {
    const prescriptions =
      await this.pharmacyService.findActivePrescriptions(
        req.user.hospitalId!,
      );

    return {
      success: true,
      data: prescriptions,
      message: 'Active prescriptions retrieved successfully',
    };
  }
}