
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly six digits.',
  })
  otp: string;
}
