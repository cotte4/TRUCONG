import { Global, Module } from '@nestjs/common';
import { ActionLogPersistenceService } from './action-log-persistence.service';
import { AnalyticsEventService } from './analytics-event.service';
import { ConnectionSessionPersistenceService } from './connection-session-persistence.service';
import { MatchPersistenceService } from './match-persistence.service';
import { PrismaService } from './prisma.service';
import { RoomPersistenceService } from './room-persistence.service';

@Global()
@Module({
  providers: [
    PrismaService,
    RoomPersistenceService,
    MatchPersistenceService,
    ConnectionSessionPersistenceService,
    ActionLogPersistenceService,
    AnalyticsEventService,
  ],
  exports: [
    PrismaService,
    RoomPersistenceService,
    MatchPersistenceService,
    ConnectionSessionPersistenceService,
    ActionLogPersistenceService,
    AnalyticsEventService,
  ],
})
export class PersistenceModule {}
