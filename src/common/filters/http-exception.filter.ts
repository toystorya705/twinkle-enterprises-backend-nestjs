import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ApiEnvelope } from '../interfaces/api-envelope.interface';

type NestErrorResponse =
  | string
  | {
      message?: string | string[];
      error?: string;
      statusCode?: number;
      [key: string]: unknown;
    };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = this.resolveStatus(exception);
    const exceptionResponse =
      exception instanceof HttpException
        ? toNestErrorResponse(exception.getResponse())
        : null;

    response.status(status).json(
      this.buildBody(status, exceptionResponse, exception, request),
    );
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return HttpStatus.CONFLICT;
      }

      if (exception.code === 'P2025') {
        return HttpStatus.NOT_FOUND;
      }
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private buildBody(
    status: number,
    exceptionResponse: NestErrorResponse | null,
    exception: unknown,
    request: Request,
  ): ApiEnvelope {
    const production = this.config.get('app.nodeEnv') === 'production';
    const message = this.resolveMessage(status, exceptionResponse, exception);
    const details = this.resolveDetails(exceptionResponse);

    return {
      success: false,
      data: null,
      message: null,
      error: {
        code: String(status),
        message,
        details: production
          ? details
          : {
              ...details,
              path: request.url,
              method: request.method,
              stack: exception instanceof Error ? exception.stack : undefined,
            },
      },
    };
  }

  private resolveMessage(
    status: number,
    exceptionResponse: NestErrorResponse | null,
    exception: unknown,
  ): string {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return 'A record with this unique value already exists';
      }

      if (exception.code === 'P2025') {
        return 'Record not found';
      }
    }

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const message = exceptionResponse?.message;
    if (Array.isArray(message)) {
      return message[0] ?? 'Request failed';
    }

    if (message) {
      return message;
    }

    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal Server Error'
      : exceptionResponse?.error ?? 'Request failed';
  }

  private resolveDetails(
    exceptionResponse: NestErrorResponse | null,
  ): Record<string, unknown> | undefined {
    if (!exceptionResponse || typeof exceptionResponse === 'string') {
      return undefined;
    }

    return { ...exceptionResponse };
  }
}

function toNestErrorResponse(response: string | object): NestErrorResponse {
  if (typeof response === 'string') {
    return response;
  }

  if (isNestErrorObject(response)) {
    return response;
  }

  return {};
}

function isNestErrorObject(response: object): response is Exclude<NestErrorResponse, string> {
  return typeof response === 'object' && response !== null;
}
