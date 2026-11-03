import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Patch,
} from '@nestjs/common';

import { BillingService } from './billing.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RecordPaymentDto } from './dto/record-payment.dto.js';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  createInvoice(
    @Body() dto: CreateInvoiceDto,
    @Req() req: any,
  ) {
    return this.billingService.createInvoice(dto, req.user);
  }

  @Get('invoices')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  getInvoices(@Req() req: any) {
    return this.billingService.getInvoices(req.user);
  }

  @Get('invoices/:id')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  getInvoiceById(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.billingService.getInvoiceById(id, req.user);
  }

    @Patch('invoices/:id/issue')
    @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
    async issueInvoice(
    @Param('id') id: string,
    @Req() req: any,
    ) {
    const invoice = await this.billingService.issueInvoice(
        id,
        req.user,
    );

    return {
        success: true,
        data: invoice,
        message: 'Invoice issued successfully',
    };
    }

    @Post('payments')
    @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
    async recordPayment(
    @Body() dto: RecordPaymentDto,
    @Req() req: any,
    ) {
    const result = await this.billingService.recordPayment(
        dto,
        req.user,
    );

    return {
        success: true,
        data: result,
        message: 'Payment recorded successfully',
    };
    }

    @Get('invoices/:id/payments')
    @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
    async getInvoicePayments(
    @Param('id') id: string,
    @Req() req: any,
    ) {
    const result = await this.billingService.getInvoicePayments(
        id,
        req.user,
    );

    return {
        success: true,
        data: result,
        message: 'Invoice payment history retrieved successfully',
    };
    }

    @Get('invoices/:id/balance')
    @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
    async getInvoiceBalance(
    @Param('id') id: string,
    @Req() req: any,
    ) {
    const result = await this.billingService.getInvoiceBalance(
        id,
        req.user,
    );

    return {
        success: true,
        data: result,
        message: 'Invoice balance retrieved successfully',
    };
    }
}