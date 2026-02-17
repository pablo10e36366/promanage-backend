import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleType } from '../../domain/permissions';
import { AuthValidationService } from '../../../auth/application/services/auth-validation.service';

interface JwtUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  private authValidationService: AuthValidationService;

  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | string>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredRolesArray: string[] = Array.isArray(requiredRoles)
      ? requiredRoles.map((r) => String(r).toLowerCase())
      : requiredRoles
        ? [String(requiredRoles).toLowerCase()]
        : [];

    if (!requiredRolesArray || requiredRolesArray.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtUser }>();
    const jwtUser = request.user;

    if (!jwtUser || !jwtUser.id) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (!this.authValidationService) {
      this.authValidationService = this.moduleRef.get(AuthValidationService, {
        strict: false,
      });
    }

    const dbUser = await this.authValidationService.validateUser(jwtUser.id);

    const jwtRole = jwtUser.role ? String(jwtUser.role).toLowerCase() : undefined;
    const dbRole = dbUser.role?.name ? String(dbUser.role.name).toLowerCase() : undefined;

    if (!jwtRole && !dbRole) {
      throw new ForbiddenException('Usuario sin rol asignado');
    }

    if (dbRole === RoleType.ADMIN || jwtRole === RoleType.ADMIN) {
      return true;
    }

    if (jwtRole && requiredRolesArray.includes(jwtRole)) {
      return true;
    }

    if (dbRole && requiredRolesArray.includes(dbRole)) {
      return true;
    }

    throw new ForbiddenException('No tienes permisos suficientes');
  }
}
