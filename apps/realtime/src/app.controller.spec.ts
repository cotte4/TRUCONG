import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomStoreService } from './rooms/room-store.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, RoomStoreService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health metadata', () => {
      expect(appController.getHealth()).toEqual(
        expect.objectContaining({
          service: 'dimadong-realtime',
          status: 'ok',
        }),
      );
    });
  });
});
