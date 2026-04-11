import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GameGateway } from './game.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? true;
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 4001);

  process.on('SIGTERM', () => {
    const gateway = app.get(GameGateway);
    gateway.server.emit('server:restarting');
    setTimeout(() => void app.close(), 2_000);
  });
}
void bootstrap();
