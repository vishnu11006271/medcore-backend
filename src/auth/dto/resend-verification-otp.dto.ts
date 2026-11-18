import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationOtpDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}