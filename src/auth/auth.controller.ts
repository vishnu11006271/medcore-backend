
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);

    return {
      success: true,
      data,
      message: 'Registration successful. Check your email for verification.',
    };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const data = await this.authService.verifyEmail(dto);

    return {
      success: true,
      data,
      message: 'Email verified successfully.',
    };
  }

  
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    const {
      refreshToken,
      refreshTokenExpiresAt
    } = result.user;

    // const { accessToken, tokenType, expiresIn } = result;

    res.cookie('medcore_refresh', refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
      expires: refreshTokenExpiresAt,
    });

    return {
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
      },
      message: 'Login successful',
    };
  }

  
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.medcore_refresh;

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_MISSING',
        message: 'Refresh token cookie is missing.',
      });
    }

    const result = await this.authService.refreshSession(token);

    res.cookie('medcore_refresh', result.refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
      expires: result.refreshTokenExpiresAt,
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
      },
      message: 'Session refreshed successfully.',
    };
  }


  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.medcore_refresh;

    await this.authService.logout(
      typeof token === 'string' ? token : undefined,
    );

    res.clearCookie('medcore_refresh', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
    });

    return {
      success: true,
      data: { loggedOut: true },
      message: 'Logged out successfully.',
    };
  }


  
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request) {
    const authUser = req.user as {
      userId: string;
    };

    const user = await this.authService.getProfile(
      authUser.userId,
    );

    return {
      success: true,
      data: user,
      message: 'Profile retrieved successfully.',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('admin-only')
  adminOnly() {
    return { success: true, message: 'Super Admin access granted.' };
  }



}
