import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiEnvelope } from '../interfaces/api-envelope.interface';

function isEnvelope(value: unknown): value is ApiEnvelope {
  return (
    !!value &&
    typeof value === 'object' &&
    'success' in value &&
    'data' in value
  );
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T> | ApiEnvelope>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T> | ApiEnvelope> {
    return next.handle().pipe(
      map((data) => {
        if (isEnvelope(data)) {
          return data;
        }

        return {
          success: true,
          data,
          message: null,
          error: null,
        };
      }),
    );
  }
}
