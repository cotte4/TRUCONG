import { Injectable } from '@nestjs/common';
import { RoomStatus, SeatStatus, TeamSide } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type {
  CreateRoomRecordInput,
  CreateSeatOccupancyInput,
  JsonInput,
} from './persistence.types';

@Injectable()
export class RoomPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(input: CreateRoomRecordInput) {
    const room = await this.prisma.room.create({
      data: {
        code: input.code,
        status: input.status ?? RoomStatus.LOBBY,
        maxPlayers: input.maxPlayers,
        targetScore: input.targetScore,
        allowBongs: input.allowBongs,
        allow3v3: input.allow3v3,
        hostSeatId: input.hostSeatId ?? null,
        seats: {
          create: Array.from({ length: input.maxPlayers }, (_, seatIndex) => ({
            seatIndex,
            teamSide: seatIndex % 2 === 0 ? TeamSide.A : TeamSide.B,
            status: SeatStatus.OPEN,
          })),
        },
      },
      include: { seats: true },
    });

    if (!room.hostSeatId && room.seats[0]) {
      return this.prisma.room.update({
        where: { id: room.id },
        data: { hostSeatId: room.seats[0].id },
        include: { seats: true },
      });
    }

    return room;
  }

  async findRoomByCode(code: string) {
    return this.prisma.room.findUnique({
      where: { code },
      include: {
        seats: {
          include: {
            occupancies: {
              where: { isCurrent: true },
              orderBy: { joinedAt: 'desc' },
              take: 1,
              include: {
                connections: {
                  orderBy: { connectedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        matches: true,
        snapshots: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
  }

  async setRoomStatus(roomId: string, status: RoomStatus) {
    return this.prisma.room.update({
      where: { id: roomId },
      data: { status },
    });
  }

  async setCurrentMatch(roomId: string, matchId: string | null) {
    return this.prisma.room.update({
      where: { id: roomId },
      data: { currentMatchId: matchId },
    });
  }

  async setHostSeat(roomId: string, hostSeatId: string | null) {
    return this.prisma.room.update({
      where: { id: roomId },
      data: { hostSeatId },
    });
  }

  async updateSeatStatus(
    roomSeatId: string,
    status: SeatStatus,
    displayName?: string | null,
  ) {
    return this.prisma.roomSeat.update({
      where: { id: roomSeatId },
      data: {
        status,
        displayName,
      },
    });
  }

  async claimSeat(input: CreateSeatOccupancyInput) {
    return this.prisma.$transaction(async (tx) => {
      const occupancy = await tx.seatOccupancy.create({
        data: {
          roomSeatId: input.roomSeatId,
          guestPlayerId: input.guestPlayerId,
          roomSessionToken: input.roomSessionToken,
          seatClaimToken: input.seatClaimToken,
          isCurrent: input.isCurrent ?? true,
        },
      });

      await tx.roomSeat.update({
        where: { id: input.roomSeatId },
        data: { status: SeatStatus.OCCUPIED },
      });

      return occupancy;
    });
  }

  async releaseSeat(roomSeatId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.seatOccupancy.updateMany({
        where: { roomSeatId, isCurrent: true },
        data: {
          isCurrent: false,
          releasedAt: new Date(),
        },
      });

      return tx.roomSeat.update({
        where: { id: roomSeatId },
        data: {
          status: SeatStatus.DISCONNECTED,
        },
      });
    });
  }

  async storeRoomSnapshot(
    roomId: string,
    version: number,
    state: JsonInput,
    matchId?: string | null,
  ) {
    return this.prisma.matchSnapshot.create({
      data: {
        roomId,
        matchId: matchId ?? null,
        version,
        state,
      },
    });
  }
}
