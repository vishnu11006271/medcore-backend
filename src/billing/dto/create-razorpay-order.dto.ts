import { IsUUID } from 'class-validator';

export class CreateRazorpayOrderDto {
  @IsUUID()
  invoiceId: string;
}