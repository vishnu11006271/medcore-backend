import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  ServiceUnavailableException
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

import { emailVerificationTemplate } from './templates/email-verification.template.js';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  private transporter!: Transporter;

  constructor(
    private readonly configService: ConfigService
  ) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = Number(this.configService.get<string>('MAIL_PORT') ?? 587);
    const secure =
      this.configService.get<string>('MAIL_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('MAIL_USER');
    const password = this.configService.get<string>('MAIL_PASSWORD');

    if (!host || !user || !password || !Number.isInteger(port)) {
      throw new InternalServerErrorException(
        'Email SMTP configuration is missing or invalid'
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  async sendVerificationOtp(
    email: string,
    firstName: string,
    otp: string
  ): Promise<void> {
    const from = this.configService.get<string>('MAIL_FROM');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (!from || !frontendUrl) {
      throw new InternalServerErrorException(
        'Email sender or frontend URL configuration is missing'
      );
    }

    let verificationPageUrl: URL;

    try {
      verificationPageUrl = new URL('/verify-email', frontendUrl);
      verificationPageUrl.searchParams.set('email', email);
    } catch {
      throw new InternalServerErrorException(
        'FRONTEND_URL configuration is invalid'
      );
    }

    const template = emailVerificationTemplate(
      firstName,
      otp,
      verificationPageUrl.toString()
    );

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      this.logger.log('Verification email accepted by SMTP provider');
    } catch (error) {
      // Do not log OTPs, SMTP credentials, or provider response bodies.
      this.logger.error(
        `Verification email delivery failed. Error code: ${
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : 'UNKNOWN'
        }`
      );

      throw new ServiceUnavailableException({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'We could not send the verification email. Please try again.'
      });
    }
  }

  // Keep the existing method so DoctorsService does not need to change.
  async sendDoctorVerificationOtp(
    email: string,
    firstName: string,
    otp: string
  ): Promise<void> {
    return this.sendVerificationOtp(email, firstName, otp);
  }
}