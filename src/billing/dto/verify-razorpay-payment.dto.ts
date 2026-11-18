import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  razorpay_payment_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  razorpay_signature: string;
}