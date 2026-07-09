import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { setupSwagger } from './config/swagger.config';

function parseCorsOrigin(origin: string): boolean | string[] {
  if (origin === '*') {
    return true;
  }

  return origin.split(',').map((entry) => entry.trim()).filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);
  const prefix = config.get<string>('app.globalPrefix') ?? 'api';
  const port = config.get<number>('app.port') ?? 3000;
  const uploadDestination =
    config.get<string>('uploads.destination') ?? 'uploads';
  const trustProxy = config.get<boolean>('security.trustProxy') ?? false;
  const requestTimeoutMs = config.get<number>('security.requestTimeoutMs') ?? 30000;
  const bodyLimit = config.get<string>('security.bodyLimit') ?? '1mb';

  app.set('trust proxy', trustProxy);
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
  app.use(cookieParser());
  app.use(hpp());
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(requestTimeoutMs);
    res.setTimeout(requestTimeoutMs);
    next();
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
    }),
  );
  app.useStaticAssets(join(process.cwd(), uploadDestination), {
    prefix: '/uploads',
  });
  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: parseCorsOrigin(config.get<string>('cors.origin') ?? '*'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(config));
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  setupSwagger(app, config);

  await app.listen(port);
  logger.log(`API listening at http://localhost:${port}/${prefix}`);
  logger.log(`Swagger available at http://localhost:${port}/${prefix}/docs`);
}

void bootstrap();
