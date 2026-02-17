import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Global Exception Filter
 * Centraliza el manejo de errores del backend:
 * - Mapea errores TypeORM y Postgres a respuestas HTTP comprensibles
 * - NUNCA expone stack traces al cliente
 * - Formato consistente: { statusCode, error, message, timestamp }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Error interno del servidor';
        let error = 'Internal Server Error';

        // 1️⃣ HttpException (errores controlados de NestJS)
        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                message = (exceptionResponse as any).message || exception.message;
                error = (exceptionResponse as any).error || exception.name;
            }
        }
        // 2️⃣ TypeORM QueryFailedError (errores de base de datos)
        else if (exception instanceof QueryFailedError) {
            const dbError = exception as any;
            statusCode = HttpStatus.BAD_REQUEST;

            // Mapeo de códigos de error PostgreSQL
            switch (dbError.code) {
                case '23505': // Duplicate key
                    error = 'Duplicate Entry';
                    message = 'Ya existe un registro con esos datos';
                    // Extraer campo del detalle si está disponible
                    if (dbError.detail) {
                        const match = dbError.detail.match(/Key \(([^)]+)\)/);
                        if (match) {
                            message = `Ya existe un registro con ese ${match[1]}`;
                        }
                    }
                    break;
                case '23503': // Foreign key violation
                    error = 'Foreign Key Violation';
                    message = 'El registro está siendo referenciado por otros datos';
                    break;
                case '23502': // Not null violation
                    error = 'Missing Required Field';
                    message = 'Falta un campo requerido';
                    break;
                case '22P02': // Invalid text representation
                    error = 'Invalid Data Format';
                    message = 'Formato de datos inválido';
                    break;
                default:
                    error = 'Database Error';
                    message = 'Error en la base de datos';
            }

            // Log del error real para debugging
            this.logger.error(
                `Database error [${dbError.code}]: ${dbError.message}`,
                dbError.stack,
            );
        }
        // 3️⃣ Errores desconocidos
        else {
            const unknownError = exception as any;
            this.logger.error(
                `Unhandled exception: ${unknownError?.message || 'Unknown error'}`,
                unknownError?.stack,
            );
        }

        // Log de errores 4xx y 5xx (excepto 401/404 que son comunes)
        if (statusCode >= 400 && ![401, 404].includes(statusCode)) {
            this.logger.warn(
                `[${statusCode}] ${request.method} ${request.url} - ${message}`,
            );
        }

        // Respuesta unificada (NUNCA incluye stack trace)
        response.status(statusCode).json({
            statusCode,
            error,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
