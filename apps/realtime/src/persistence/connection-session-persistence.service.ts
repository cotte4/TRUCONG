import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ConnectionSessionPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async connect(occupancyId: string, socketId: string, reconnectToken: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.connectionSession.updateMany({
        where: {
          occupancyId,
          disconnectedAt: null,
        },
        data: {
          disconnectedAt: new Date(),
        },
      });

      return tx.connectionSession.create({
        data: {
          occupancyId,
          socketId,
          reconnectToken,
        },
      });
    });
  }

  async disconnectBySocketId(socketId: string) {
    await this.prisma.connectionSession.updateMany({
      where: {
        socketId,
        disconnectedAt: null,
      },
      data: {
        disconnectedAt: new Date(),
      },
    });
  }
}
