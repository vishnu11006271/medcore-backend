
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Allow requests from our Angular frontend
  app.enableCors({
    origin: [
    'http://localhost:4200',
    'https://medcore-frontend-7uhi.vercel.app'
  ],
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

  app.useGlobalFilters(new ApiExceptionFilter());

  app.use(cookieParser());

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Medcore HMS API')
      .setDescription(
        'REST API for the Medcore Hospital Management System. Protected endpoints use JWT Bearer access tokens; refresh sessions use the HttpOnly medcore_refresh cookie.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste the access token returned by POST /auth/login.',
        },
        'access-token',
      )
      .addCookieAuth(
        'medcore_refresh',
        {
          type: 'apiKey',
          in: 'cookie',
          description: 'HttpOnly refresh cookie set by login and refresh endpoints.',
        },
        'refresh-cookie',
      )
      .build();

    const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, openApiDocument, {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
