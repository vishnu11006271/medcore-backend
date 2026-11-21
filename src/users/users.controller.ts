import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
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
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

import { UsersService } from './users.service.js';
import { GetUsersQueryDto } from './dto/get-users-query.dto.js';
import { IsBoolean } from 'class-validator';

class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    role: string;
    hospitalId: string | null;
  };
};

@Controller('users')
@ApiTags('Platform Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@Query() query: GetUsersQueryDto) {
    const data = await this.usersService.findAll(query);

    return {
      success: true,
      data,
      message: 'Platform users retrieved successfully.',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.usersService.findOne(id);

    return {
      success: true,
      data,
      message: 'User details retrieved successfully.',
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.usersService.updateStatus(
      id,
      dto.isActive,
      req.user.userId,
    );

    return {
      success: true,
      data,
      message: `User ${dto.isActive ? 'activated' : 'deactivated'} successfully.`,
    };
  }
}