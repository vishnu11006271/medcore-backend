
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

import { BillingService } from './billing.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { RecordPaymentDto } from './dto/record-payment.dto.js';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto.js';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Create invoice
  @Post('invoices')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @Req() req: any,
  ) {
    const result = await this.billingService.createInvoice(dto, req.user);

    return {
      success: true,
      data: result,
      message: 'Invoice created successfully',
    };
  }

  // Get all invoices
  @Get('invoices')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async getInvoices(@Req() req: any) {
    const result = await this.billingService.getInvoices(req.user);

    return {
      success: true,
      data: result,
      message: 'Invoices fetched successfully',
    };
  }

  // Get invoice by ID
  @Get('invoices/:id')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async getInvoiceById(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const result = await this.billingService.getInvoiceById(id, req.user);

    return {
      success: true,
      data: result,
      message: 'Invoice fetched successfully',
    };
  }

  // Issue invoice
  @Patch('invoices/:id/issue')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async issueInvoice(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const result = await this.billingService.issueInvoice(id, req.user);

    return {
      success: true,
      data: result,
      message: 'Invoice issued successfully',
    };
  }

  // Record manual payment
  @Post('payments')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @Req() req: any,
  ) {
    const result = await this.billingService.recordPayment(dto, req.user);

    return {
      success: true,
      data: result,
      message: 'Payment recorded successfully',
    };
  }

  // Get invoice payment history
  @Get('invoices/:id/payments')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async getInvoicePayments(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const result = await this.billingService.getInvoicePayments(id, req.user);

    return {
      success: true,
      data: result,
      message: 'Payment history fetched successfully',
    };
  }

  // Get invoice balance
  @Get('invoices/:id/balance')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async getInvoiceBalance(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const result = await this.billingService.getInvoiceBalance(id, req.user);

    return {
      success: true,
      data: result,
      message: 'Invoice balance fetched successfully',
    };
  }

  // Create Razorpay order
  @Post('payments/razorpay/order')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async createRazorpayOrder(
    @Body() dto: CreateRazorpayOrderDto,
    @Req() req: any,
  ) {
    const result = await this.billingService.createRazorpayOrder(dto, req.user);

    return {
      success: true,
      data: result,
      message: 'Razorpay order created successfully',
    };
  }

  // Verify Razorpay payment
  @Post('payments/razorpay/verify')
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT')
  async verifyRazorpayPayment(
    @Body() dto: VerifyRazorpayPaymentDto,
    @Req() req: any,
  ) {
    const result = await this.billingService.verifyRazorpayPayment(
      dto,
      req.user,
    );

    return {
      success: true,
      data: result,
      message: 'Payment verified successfully',
    };
  }

  @Post('payments/razorpay/cancel')
  @Roles('HOSPITAL_ADMIN', 'ACCOUNTANT')
  async markRazorpayPaymentDismissed(
    @Body() body: { orderId: string },
    @Req() req: any,
  ) {
    const result =
      await this.billingService.markRazorpayPaymentDismissed(
        body.orderId,
        req.user,
      );

    return {
      success: true,
      data: result,
      message: 'Razorpay checkout dismissal processed',
    };
  }

//   @Get('razorpay/inspect/:orderId')
// @Roles('HOSPITAL_ADMIN')
// async inspectRazorpayOrder(
//   @Param('orderId') orderId: string,
//   @Req() req: any,
// ) {
//   return {
//     success: true,
//     data: await this.billingService.inspectRazorpayOrder(
//       orderId,
//       req.user,
//     ),
//     message: 'Razorpay order inspected successfully',
//   };
// }

// @Patch('razorpay/reconcile/:orderId')
// @Roles('HOSPITAL_ADMIN')
// async reconcileRazorpayOrder(
//   @Param('orderId') orderId: string,
//   @Req() req: any,
// ) {
//   const result =
//     await this.billingService.cancelAbandonedRazorpayOrder(
//       orderId,
//       req.user,
//     );

//   return {
//     success: true,
//     data: result,
//     message: 'Abandoned Razorpay order reconciled successfully',
//   };
// }
}
