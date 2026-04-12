import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GameGateway } from './game.gateway';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

class RecoveryIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      connectionStateRecovery: {
        // Matches the 20s reconnect_hold grace window in RoomStoreService
        maxDisconnectionDuration: 20_000,
        // Skip auth middleware on successful recovery — socket.data is already restored
        skipMiddlewares: true,
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new RecoveryIoAdapter(app));

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
