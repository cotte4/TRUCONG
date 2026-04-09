import { Injectable } from '@nestjs/common';
import { AnalyticsEventType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type { CreateAnalyticsEventInput } from './persistence.types';

@Injectable()
export class AnalyticsEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: CreateAnalyticsEventInput) {
    return this.prisma.analyticsEvent.create({
      data: {
        roomId: input.roomId ?? null,
        type: input.type,
        payload: input.payload ?? Prisma.JsonNull,
      },
    });
  }

  async roomCreated(roomId: string, payload?: Prisma.InputJsonValue) {
    return this.record({
      roomId,
      type: AnalyticsEventType.ROOM_CREATED,
      payload,
    });
  }

  async matchStarted(roomId: string, payload?: Prisma.InputJsonValue) {
    return this.record({
      roomId,
      type: AnalyticsEventType.MATCH_STARTED,
      payload,
    });
  }

  async matchFinished(roomId: string, payload?: Prisma.InputJsonValue) {
    return this.record({
      roomId,
      type: AnalyticsEventType.MATCH_FINISHED,
      payload,
    });
  }

  async reconnectSuccess(roomId: string, payload?: Prisma.InputJsonValue) {
    return this.record({
      roomId,
      type: AnalyticsEventType.RECONNECT_SUCCESS,
      payload,
    });
  }

  async seatReplaced(roomId: string, payload?: Prisma.InputJsonValue) {
    return this.record({
      roomId,
      type: AnalyticsEventType.SEAT_REPLACED,
      payload,
    });
  }
}
