import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'dimadong-realtime',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
