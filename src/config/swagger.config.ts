import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication, config: ConfigService): void {
  const prefix = config.get<string>('app.globalPrefix') ?? 'api';
  const documentConfig = new DocumentBuilder()
    .setTitle('Twinkle Enterprises API')
    .setDescription('Enterprise CRM and e-commerce backend API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
