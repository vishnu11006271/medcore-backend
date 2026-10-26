
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

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

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    hospitalId: string | null;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        hospitalId: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || !user.isActive || !user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'This account is unavailable. Please log in again.',
      });
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    };
  }
}
