import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameGateway } from './game.gateway';
import { PersistenceModule } from './persistence';
import { RoomsController } from './rooms/rooms.controller';
import { RoomStoreService } from './rooms/room-store.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PersistenceModule],
  controllers: [AppController, RoomsController],
  providers: [AppService, GameGateway, RoomStoreService],
})
export class AppModule {}
