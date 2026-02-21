import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

function normalizeOrigin(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function matchesWildcardOrigin(pattern: string, origin: string): boolean {
  if (!pattern.includes('*')) {
    return false;
  }

  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(`^${escapedPattern}$`).test(origin);
}

function isAllowedOrigin(origin: string, configuredOrigins: string[]): boolean {
  const normalizedOrigin = normalizeOrigin(origin);

  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalizedOrigin)) {
    return true;
  }

  if (configuredOrigins.length === 0 || configuredOrigins.includes('*')) {
    return true;
  }

  return configuredOrigins.some((configuredOrigin) => {
    const normalizedConfiguredOrigin = normalizeOrigin(configuredOrigin);

    return (
      normalizedConfiguredOrigin === normalizedOrigin ||
      matchesWildcardOrigin(normalizedConfiguredOrigin, normalizedOrigin)
    );
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Allow larger payloads for rich HTML content and attached assets.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const configuredOrigins = (configService.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (isAllowedOrigin(origin, configuredOrigins)) {
        return callback(null, true);
      }

      callback(new Error(`Not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });

  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix);

  const config = new DocumentBuilder()
    .setTitle('ProManage API')
    .setDescription('API for project and evidence management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(apiPrefix, app, document);

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');

  console.log(`ProManage API listening on port ${port}`);
  console.log(`Swagger available at /${apiPrefix}`);
}

void bootstrap();
