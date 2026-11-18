
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';


import { UserRole } from '../../generated/prisma/client.js';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  hospitalId?: string | null;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // async validate(payload: {
  //   sub: string;
  //   email: string;
  //   role: string;
  //   hospitalId: string | null;
  // }) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: payload.sub },
  //     select: {
  //       id: true,
  //       email: true,
  //       role: true,
  //       hospitalId: true,
  //       isActive: true,
  //       emailVerifiedAt: true,
  //     },
  //   });

  //   if (!user || !user.isActive || !user.emailVerifiedAt) {
  //     throw new UnauthorizedException({
  //       code: 'ACCOUNT_UNAVAILABLE',
  //       message: 'This account is unavailable. Please log in again.',
  //     });
  //   }

  //   return {
  //     userId: user.id,
  //     email: user.email,
  //     role: user.role,
  //     hospitalId: user.hospitalId,
  //   };
  // }


  
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        hospital: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user || !user.isActive || !user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'Your account is unavailable.',
      });
    }

    const hospitalStaffRoles: UserRole[] = [
      UserRole.HOSPITAL_ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.RECEPTIONIST,
      UserRole.LAB_TECHNICIAN,
      UserRole.PHARMACIST,
      UserRole.ACCOUNTANT,
    ];

    if (hospitalStaffRoles.includes(user.role)) {
      if (
        !user.hospitalId ||
        !user.hospital ||
        user.hospital.status !== 'VERIFIED'
      ) {
        throw new ForbiddenException({
          code: 'HOSPITAL_NOT_VERIFIED',
          message: 'Your hospital is not approved for access.',
        });
      }
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    };
  }


}
