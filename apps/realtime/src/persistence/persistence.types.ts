import type {
  AnalyticsEventType,
  MatchStatus,
  Prisma,
  RoomStatus,
  TeamSide,
} from '@prisma/client';

export type JsonInput = Prisma.InputJsonValue;

export interface CreateRoomRecordInput {
  code: string;
  maxPlayers: number;
  targetScore: number;
  allowBongs: boolean;
  allow3v3: boolean;
  hostSeatId?: string | null;
  status?: RoomStatus;
}

export interface CreateSeatOccupancyInput {
  roomSeatId: string;
  guestPlayerId: string;
  roomSessionToken: string;
  seatClaimToken: string;
  isCurrent?: boolean;
}

export interface CreateMatchRecordInput {
  roomId: string;
  status?: MatchStatus;
  winnerTeamSide?: TeamSide | null;
  effectiveBongs?: number;
  finalScore?: JsonInput | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface CreateMatchSnapshotInput {
  roomId: string;
  matchId?: string | null;
  version: number;
  state: JsonInput;
}

export interface CreateActionLogInput {
  roomId: string;
  matchId?: string | null;
  seatId?: string | null;
  occupancyId?: string | null;
  actionType: string;
  payload: JsonInput;
  effectiveBongAward?: boolean;
}

export interface CreateAnalyticsEventInput {
  roomId?: string | null;
  type: AnalyticsEventType;
  payload?: JsonInput;
}
