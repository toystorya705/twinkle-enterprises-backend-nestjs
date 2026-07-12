import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm']);

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const allowedMimeTypes = new Set(config.get<string[]>('uploads.allowedMimeTypes') ?? []);
        const destination = config.get<string>('uploads.destination') ?? 'uploads';
        mkdirSync(destination, { recursive: true });
        return {
          storage: diskStorage({
            destination,
            filename: (_req, file, callback) => {
              const extension = extname(file.originalname).toLowerCase();
              callback(null, `${randomUUID()}${extension}`);
            },
          }),
          limits: {
            fileSize: config.get<number>('uploads.maxFileSize') ?? 10485760,
            files: 1,
          },
          fileFilter: (_req, file, callback) => {
            const extension = extname(file.originalname).toLowerCase();
            if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
              callback(new BadRequestException('Unsupported file type'), false);
              return;
            }
            callback(null, true);
          },
        };
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [MulterModule],
})
export class UploadsModule {}
