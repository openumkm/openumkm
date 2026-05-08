import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Global exception filter that renders errors via EJS for HTML routes
 * and returns JSON for /api/* and /health paths.
 *
 * Replaces manual fastify.setNotFoundHandler / setErrorHandler to avoid
 * conflicts with Nest's built-in handlers registered during listen().
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof Error ? exception.message : 'Internal Server Error';

    const url = request.url || '';

    // Log non-404 errors to console for debugging
    if (status >= 500) {
      console.error('[Error]', exception);
    }

    // API / health endpoints get JSON
    if (url.startsWith('/api/') || url.startsWith('/health')) {
      return response.status(status).send({
        error: message,
        statusCode: status,
      });
    }

    // HTML routes: render 404 view with error context
    return response.status(status).view('404.ejs', {
      pageTitle:
        status === 404 ? '404 — Page Not Found' : `${status} — Error`,
      error: status === 404 ? null : message,
      isLoggedIn: false,
      cartCount: 0,
    });
  }
}
