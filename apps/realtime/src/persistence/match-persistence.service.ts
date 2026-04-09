import { Injectable } from '@nestjs/common';
import { MatchStatus, Prisma, TeamSide } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type { CreateMatchRecordInput, CreateMatchSnapshotInput } from './persistence.types';

@Injectable()
export class MatchPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async createMatch(input: CreateMatchRecordInput) {
    const match = await this.prisma.match.create({
      data: {
        roomId: input.roomId,
        status: input.status ?? MatchStatus.PENDING,
        winnerTeamSide: input.winnerTeamSide ?? null,
        effectiveBongs: input.effectiveBongs ?? 0,
        finalScore: input.finalScore ?? Prisma.JsonNull,
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
      },
    });

    await this.prisma.room.update({
      where: { id: input.roomId },
      data: { currentMatchId: match.id },
    });

    return match;
  }

  async startMatch(matchId: string) {
    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
  }

  async finishMatch(matchId: string, input: { winnerTeamSide: TeamSide; finalScore: unknown; effectiveBongs?: number }) {
    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.FINISHED,
        winnerTeamSide: input.winnerTeamSide,
        finalScore: input.finalScore as Prisma.InputJsonValue,
        effectiveBongs: input.effectiveBongs ?? 0,
        finishedAt: new Date(),
      },
    });
  }

  async createSnapshot(input: CreateMatchSnapshotInput) {
    return this.prisma.matchSnapshot.create({
      data: {
        roomId: input.roomId,
        matchId: input.matchId ?? null,
        version: input.version,
        state: input.state as Prisma.InputJsonValue,
      },
    });
  }

  async listRecentSnapshots(roomId: string, take = 5) {
    return this.prisma.matchSnapshot.findMany({
      where: { roomId },
      orderBy: { version: 'desc' },
      take,
    });
  }
}
