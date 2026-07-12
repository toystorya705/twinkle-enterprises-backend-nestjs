import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  describe(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const relativePath = `uploads/${file.filename}`;
    const publicBaseUrl = (this.config.get<string>('uploads.publicBaseUrl') ?? '').replace(/\/+$/, '');

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: relativePath,
      relativePath,
      url: `${publicBaseUrl}/${relativePath}`,
    };
  }
}
