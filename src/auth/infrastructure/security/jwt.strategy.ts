import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error(
        'JWT_SECRET no está definido en las variables de entorno',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: {
    sub: number;
    email: string;
    name?: string;
    role?: string;
  }) {
    if (!payload.sub || !payload.email) {
      throw new Error('Payload JWT inválido');
    }

    const roleStr = payload.role ? String(payload.role).toLowerCase() : 'usuario';

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? '',
      role: roleStr,
    };
  }
}
