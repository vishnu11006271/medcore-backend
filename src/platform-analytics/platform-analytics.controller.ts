import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PlatformAnalyticsService } from './platform-analytics.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('platform-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PlatformAnalyticsController {
  constructor(
    private readonly platformAnalyticsService: PlatformAnalyticsService,
  ) {}

  @Get('overview')
  async getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.platformAnalyticsService.getOverview(
      startDate,
      endDate,
    );

    return {
      success: true,
      data,
      message: 'Platform analytics fetched successfully',
    };
  }
}