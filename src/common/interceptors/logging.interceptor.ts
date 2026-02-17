import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request } from 'express';
import { ActivityService } from '../../activity/application/services/activity.service';
import { User } from '../../users/infrastructure/entities/user.entity';

/**
 * Logging Interceptor
 * Audita automÃ¡ticamente errores 4xx y 5xx:
 * - Log en consola con contexto completo
 * - Registro en activity_logs via ActivityService
 * - Incluye: userId, endpoint, method, statusCode, timestamp
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    constructor(private readonly activityService: ActivityService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<Request & { user?: User }>();
        const { method, url, user } = request;
        const startTime = Date.now();

        return next.handle().pipe(
            tap(() => {
                // Log de requests exitosos (opcional, comentado para no saturar logs)
                // const duration = Date.now() - startTime;
                // this.logger.log(`[SUCCESS] ${method} ${url} - ${duration}ms`);
            }),
            catchError((error) => {
                const duration = Date.now() - startTime;
                const statusCode = error?.status || error?.statusCode || 500;

                // Solo logear errores 4xx y 5xx
                if (statusCode >= 400) {
                    const errorMessage = error?.message || 'Unknown error';
                    const userId = user?.id || null;

                    // Log en consola
                    this.logger.error(
                        `[${statusCode}] ${method} ${url} - User: ${userId || 'guest'} - ${duration}ms - ${errorMessage}`,
                    );

                    // TODO: Guardar en activity_logs cuando se agregue 'ERROR' al enum activity_logs_action_enum
                    // if (user) {
                    //     this.activityService
                    //         .logActivity(user, 'ERROR' as any, {
                    //             endpoint: url,
                    //             method,
                    //             statusCode,
                    //             errorMessage,
                    //             duration,
                    //         })
                    //         .catch((logError) => {
                    //             this.logger.error(
                    //                 `Failed to log activity: ${logError.message}`,
                    //             );
                    //         });
                    // }
                }

                return throwError(() => error);
            }),
        );
    }
}

