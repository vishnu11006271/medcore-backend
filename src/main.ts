import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.useGlobalFilters(new ApiExceptionFilter());
  await app.use(cookieParser());
  await app.listen(process.env.PORT ?? 3000);
  
}
await bootstrap();
