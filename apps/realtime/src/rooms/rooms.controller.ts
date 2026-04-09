import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type {
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
    return this.buildRoomEntryResponse(this.roomStore.createRoom(body));
  }

  @Post(':code/join')
  joinRoom(@Param('code') code: string, @Body() body: JoinRoomRequest): RoomEntryResponse {
    return this.buildRoomEntryResponse(this.roomStore.joinRoom(code, body));
  }

  @Post(':code/resume')
  resumeRoom(@Param('code') code: string, @Body() body: SessionResumePayload): Promise<ResumeRoomResponse> {
    return this.buildResumeResponse(code, body.roomSessionToken);
  }

  @Get(':code')
  getRoom(
    @Param('code') code: string,
    @Query('roomSessionToken') roomSessionToken?: string,
  ): Promise<ResumeRoomResponse> {
    return this.buildResumeResponse(code, roomSessionToken);
  }

  private async buildResumeResponse(
    code: string,
    roomSessionToken?: string | null,
  ): Promise<ResumeRoomResponse> {
    const result = (await this.roomStore.resumeRoom(code, roomSessionToken)) as ResumeRoomResponse & {
      state?: MatchProgressState | null;
    };
    const lifecycle = this.roomStore.getRoomLifecycleState(code, result.session?.seatId ?? null);
    const progressState = lifecycle.progressState;
    const transition = lifecycle.transitionState;
    const wildcardSelection = lifecycle.wildcardSelectionState;
    return {
      ...result,
      matchView: result.matchView ?? lifecycle.matchView,
      state: result.state ?? progressState ?? this.buildMatchProgressState(result.snapshot, result.matchView),
      transition,
      wildcardSelection,
    };
  }

  private buildRoomEntryResponse(response: RoomEntryResponse): RoomEntryResponse {
    const lifecycle = this.roomStore.getRoomLifecycleState(response.session.roomCode, response.session.seatId);
    const matchView = response.matchView ?? lifecycle.matchView;
    const progressState = lifecycle.progressState;
    const transition = lifecycle.transitionState;
    const wildcardSelection = lifecycle.wildcardSelectionState;
    return {
      ...response,
      matchView,
      state: response.state ?? progressState ?? this.buildMatchProgressState(response.snapshot, matchView),
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
