import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto.js';
import { NotificationsService } from './notifications.service.js';

type AuthenticatedRequest = Request & {
  user: { userId: string };
};

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const data = await this.notificationsService.findForUser(
      req.user.userId,
      query,
    );

    return {
      success: true,
      data,
      message: 'Notifications retrieved successfully.',
    };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    const data = await this.notificationsService.markAllAsRead(
      req.user.userId,
    );

    return {
      success: true,
      data,
      message: 'Notifications marked as read.',
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const data = await this.notificationsService.markAsRead(
      req.user.userId,
      id,
    );

    return {
      success: true,
      data,
      message: 'Notification marked as read.',
    };
  }
}
