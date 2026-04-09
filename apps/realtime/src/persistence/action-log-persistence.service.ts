import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import type { CreateActionLogInput } from './persistence.types';

@Injectable()
export class ActionLogPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: CreateActionLogInput) {
    return this.prisma.actionLog.create({
      data: {
        roomId: input.roomId,
        matchId: input.matchId ?? null,
        seatId: input.seatId ?? null,
        occupancyId: input.occupancyId ?? null,
        actionType: input.actionType,
        payload: input.payload,
        effectiveBongAward: input.effectiveBongAward ?? false,
      },
    });
  }

  async appendMany(entries: CreateActionLogInput[]) {
    return this.prisma.actionLog.createMany({
      data: entries.map((entry) => ({
        roomId: entry.roomId,
        matchId: entry.matchId ?? null,
        seatId: entry.seatId ?? null,
        occupancyId: entry.occupancyId ?? null,
        actionType: entry.actionType,
        payload: entry.payload,
        effectiveBongAward: entry.effectiveBongAward ?? false,
      })),
    });
  }
}
