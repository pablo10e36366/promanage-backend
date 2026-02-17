import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthValidationService } from '../../application/services/auth-validation.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private authValidationService: AuthValidationService;

  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      return false;
    }

    if (!this.authValidationService) {
      this.authValidationService = this.moduleRef.get(AuthValidationService, {
        strict: false,
      });
    }

    await this.authValidationService.validateUser(user.id);

    return true;
  }
}
