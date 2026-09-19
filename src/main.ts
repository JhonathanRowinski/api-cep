import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/**
 * Bootstraps the NestJS application.
 *
 * Creates the application instance and starts the HTTP server.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();