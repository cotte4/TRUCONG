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

  /**
   * Returns actions logged for a room after a given ISO timestamp.
   * Used by the reconnection handler to send clients a history of what
   * happened while they were disconnected (Gap 3 — DB-backed event replay).
   *
   * Max 50 entries to avoid flooding a player who was offline for hours.
   */
  async findEventsSince(roomId: string, afterISO: string, limit = 50) {
    const after = new Date(afterISO);
    if (isNaN(after.getTime())) return [];

    return this.prisma.actionLog.findMany({
      where: {
        roomId,
        createdAt: { gt: after },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        actionType: true,
        seatId: true,
        createdAt: true,
        // payload intentionally omitted — may contain card values
      },
    });
  }
}
