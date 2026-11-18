import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GetUsersQueryDto } from './dto/get-users-query.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetUsersQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);

    if (limit > 100) {
      throw new BadRequestException({
        code: 'INVALID_PAGINATION',
        message: 'Limit cannot be greater than 100.',
      });
    }

    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      ...(query.role && {
        role: query.role as Prisma.UserWhereInput['role'],
      }),

      ...(query.hospitalId && {
        hospitalId: query.hospitalId,
      }),

      ...(query.isActive !== undefined && {
        isActive: query.isActive === 'true',
      }),

      ...(query.emailVerified !== undefined && {
        emailVerifiedAt:
          query.emailVerified === 'true'
            ? { not: null }
            : null,
      }),

      ...(search && {
        OR: [
          {
            firstName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          hospitalId: true,
          createdAt: true,
          updatedAt: true,
          hospital: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),

      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        hospitalId: true,
        createdAt: true,
        updatedAt: true,
        hospital: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    return user;
  }

  async updateStatus(
    id: string,
    isActive: boolean,
    actingUserId: string,
  ) {
    if (id === actingUserId && !isActive) {
      throw new ForbiddenException({
        code: 'SELF_DEACTIVATION_NOT_ALLOWED',
        message: 'You cannot deactivate your own account.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    if (user.isActive === isActive) {
      throw new BadRequestException({
        code: 'USER_STATUS_UNCHANGED',
        message: `User is already ${isActive ? 'active' : 'inactive'}.`,
      });
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }
}