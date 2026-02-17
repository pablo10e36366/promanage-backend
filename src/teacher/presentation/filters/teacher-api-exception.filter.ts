import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
	export class TeacherApiExceptionFilter implements ExceptionFilter {
	  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Error interno del servidor';
	    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse() as any;
      message =
        typeof resp === 'string'
          ? resp
          : (resp?.message?.[0] || resp?.message || exception.message || message);
      details = typeof resp === 'object' ? resp : undefined;
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'DB_ERROR';
      message = 'Error en la base de datos';
      details = { message: (exception as any)?.message, code: (exception as any)?.code };
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    switch (status) {
      case 400:
        code = code === 'INTERNAL_ERROR' ? 'BAD_REQUEST' : code;
        break;
      case 401:
        code = 'UNAUTHORIZED';
        break;
      case 403:
        code = 'FORBIDDEN';
        break;
      case 404:
        code = 'NOT_FOUND';
        break;
      default:
        if (status >= 500) code = 'INTERNAL_ERROR';
    }

    if (status >= 500) {
      // Log full error for debugging/observability (response stays normalized)
      // eslint-disable-next-line no-console
      console.error('[TeacherApiExceptionFilter]', exception);
    }

    res.status(status).json({
      error: {
        code,
        message,
        details,
        path: req.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
