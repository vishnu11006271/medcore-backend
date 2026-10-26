import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const errorBody = body as {
          code?: string;
          message?: string | string[];
        };

        if (errorBody.code) {
          code = errorBody.code;
        } else {
          code =
            status === 400 ? 'VALIDATION_ERROR' :
            status === 401 ? 'UNAUTHORIZED' :
            status === 403 ? 'FORBIDDEN' :
            status === 404 ? 'NOT_FOUND' :
            status === 409 ? 'CONFLICT' :
            'HTTP_ERROR';
        }

        if (errorBody.message) {
          message = Array.isArray(errorBody.message)
            ? errorBody.message.join(', ')
            : errorBody.message;
        }
      }
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}