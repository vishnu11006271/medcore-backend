
import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service.js';

@Controller('billing/webhooks')
export class RazorpayWebhookController {
  constructor(
    private readonly billingService: BillingService,
  ) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string,
  ) {
    if (!request.rawBody || !signature || !eventId) {
      throw new BadRequestException(
        'Missing Razorpay webhook body or headers',
      );
    }

    return this.billingService.handleRazorpayWebhook(
      request.rawBody,
      signature,
      eventId,
    );
  }
}
