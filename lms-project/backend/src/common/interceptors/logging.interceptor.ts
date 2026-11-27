import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = Date.now();
    const { method, originalUrl } = request;

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${method} ${originalUrl} ${response.statusCode} ${Date.now() - started}ms`,
        );
      }),
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        this.logger.warn(`${method} ${originalUrl} ${status} ${Date.now() - started}ms`);
        return throwError(() => error);
      }),
    );
  }
}
