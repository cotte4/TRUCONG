import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AVATAR_IDS } from '@dimadong/contracts';
import type {
  AvatarId,
  CreateRoomRequest,
  JoinRoomRequest,
  MatchProgressState,
  RoomEntryResponse,
  ResumeRoomResponse,
  SessionResumePayload,
} from '@dimadong/contracts';
import { RoomStoreService } from './room-store.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomStore: RoomStoreService) {}

  @Post()
  createRoom(@Body() body: CreateRoomRequest): RoomEntryResponse {
    return this.buildRoomEntryResponse(
      this.roomStore.createRoom(this.parseCreateRoomRequest(body)),
    );
  }

  @Post(':code/join')
  async joinRoom(
    @Param('code') code: string,
    @Body() body: JoinRoomRequest,
  ): Promise<RoomEntryResponse> {
    const roomCode = this.normalizeRoomCode(code);
    return this.buildRoomEntryResponse(
      await this.roomStore.joinRoom(roomCode, this.parseJoinRoomRequest(body)),
    );
  }

  @Post(':code/resume')
  resumeRoom(
    @Param('code') code: string,
    @Body() body: SessionResumePayload,
  ): Promise<ResumeRoomResponse> {
    const roomCode = this.normalizeRoomCode(code);
    return this.buildResumeResponse(
      roomCode,
      this.normalizeRoomSessionToken(body?.roomSessionToken),
    );
  }

  @Get(':code')
  getRoom(
    @Param('code') code: string,
    @Query('roomSessionToken') roomSessionToken?: string,
  ): Promise<ResumeRoomResponse> {
    const roomCode = this.normalizeRoomCode(code);
    return this.buildResumeResponse(roomCode, roomSessionToken);
  }

  private normalizeRoomCode(code: unknown): string {
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new BadRequestException('Room code is required.');
    }

    return code.trim().toUpperCase();
  }

  private normalizeDisplayName(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('Display name is required.');
    }

    return value.trim();
  }

  private normalizeRoomSessionToken(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('roomSessionToken is required.');
    }

    return value.trim();
  }

  private parseAvatarId(value: unknown): AvatarId | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('avatarId must be a non-empty string.');
    }

    const normalized = value.trim() as AvatarId;

    if (!AVATAR_IDS.includes(normalized)) {
      throw new BadRequestException('avatarId is not valid.');
    }

    return normalized;
  }

  private parseCreateRoomRequest(body: CreateRoomRequest): CreateRoomRequest {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid create room payload.');
    }

    const parsed: CreateRoomRequest = {
      displayName: this.normalizeDisplayName(body.displayName),
      avatarId: this.parseAvatarId(body.avatarId),
      allowBongs:
        typeof body.allowBongs === 'boolean' ? body.allowBongs : undefined,
    };

    if (typeof body.maxPlayers !== 'undefined') {
      if (body.maxPlayers !== 2 && body.maxPlayers !== 4) {
        throw new BadRequestException('maxPlayers must be 2 or 4.');
      }
      parsed.maxPlayers = body.maxPlayers;
    }

    if (typeof body.targetScore !== 'undefined') {
      if (body.targetScore !== 15 && body.targetScore !== 30) {
        throw new BadRequestException('targetScore must be 15 or 30.');
      }
      parsed.targetScore = body.targetScore;
    }

    return parsed;
  }

  private parseJoinRoomRequest(body: JoinRoomRequest): JoinRoomRequest {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid join room payload.');
    }

    const parsed: JoinRoomRequest = {
      displayName: this.normalizeDisplayName(body.displayName),
      avatarId: this.parseAvatarId(body.avatarId),
    };

    if (typeof body.preferredSeatIndex !== 'undefined') {
      if (
        !Number.isInteger(body.preferredSeatIndex) ||
        body.preferredSeatIndex < 0
      ) {
        throw new BadRequestException(
          'preferredSeatIndex must be a non-negative integer.',
        );
      }
      parsed.preferredSeatIndex = body.preferredSeatIndex;
    }

    return parsed;
  }

  private async buildResumeResponse(
    code: string,
    roomSessionToken?: string | null,
  ): Promise<ResumeRoomResponse> {
    const result = (await this.roomStore.resumeRoom(
      code,
      roomSessionToken,
    )) as ResumeRoomResponse & {
      state?: MatchProgressState | null;
    };
    const lifecycle = this.roomStore.getRoomLifecycleState(
      code,
      result.session?.seatId ?? null,
    );
    const progressState = lifecycle.progressState;
    const transition = lifecycle.transitionState;
    const wildcardSelection = lifecycle.wildcardSelectionState;
    return {
      ...result,
      matchView: result.matchView ?? lifecycle.matchView,
      state:
        result.state ??
        progressState ??
        this.buildMatchProgressState(result.snapshot, result.matchView),
      transition,
      wildcardSelection,
    };
  }

  private buildRoomEntryResponse(
    response: RoomEntryResponse,
  ): RoomEntryResponse {
    const lifecycle = this.roomStore.getRoomLifecycleState(
      response.session.roomCode,
      response.session.seatId,
    );
    const matchView = response.matchView ?? lifecycle.matchView;
    const progressState = lifecycle.progressState;
    const transition = lifecycle.transitionState;
    const wildcardSelection = lifecycle.wildcardSelectionState;
    return {
      ...response,
      matchView,
      state:
        response.state ??
        progressState ??
        this.buildMatchProgressState(response.snapshot, matchView),
      transition,
      wildcardSelection,
    };
  }

  private buildMatchProgressState(
    snapshot: ResumeRoomResponse['snapshot'],
    matchView: ResumeRoomResponse['matchView'],
  ): MatchProgressState | null {
    if (!matchView) {
      return null;
    }

    return {
      handNumber: matchView.handNumber,
      trickNumber: matchView.trickNumber,
      dealerSeatId: matchView.dealerSeatId,
      currentTurnSeatId: matchView.currentTurnSeatId,
      phase: snapshot.phase,
      handTrickWins: matchView.trickResults.reduce(
        (acc, result) => {
          if (result.winnerTeamSide === 'A') {
            acc.A += 1;
          } else if (result.winnerTeamSide === 'B') {
            acc.B += 1;
          }

          return acc;
        },
        { A: 0, B: 0 },
      ),
      tableCards: matchView.tableCards,
      resolvedTricks: matchView.trickResults,
      score: snapshot.score,
      statusText: snapshot.statusText,
      turnDeadlineAt: snapshot.turnDeadlineAt,
      reconnectDeadlineAt: snapshot.reconnectDeadlineAt,
      summary: matchView.summary,
    };
  }
}
