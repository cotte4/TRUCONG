import {
  Ack,
  ConnectedSocket,
  OnGatewayDisconnect,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BadRequestException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import type {
  ActionSubmitAck,
  ActionSubmitPayload,
  ActionSubmittedEvent,
  ActionRejectedEvent,
  CantoOpenAck,
  CantoOpenPayload,
  CantoOpenedEvent,
  CantoResolveAck,
  CantoResolvePayload,
  CantoResolvedEvent,
  ChatReceivedEvent,
  ChatSendAck,
  ChatSendPayload,
  HandScoredEvent,
  DetailedWildcardSelectionState,
  LobbyActionPayload,
  LobbyTeamPayload,
  PlayCardPayload,
  SeatFreeAck,
  SeatFreePayload,
  SeatFreeResult,
  SummaryStartAck,
  SummaryStartPayload,
  RoomDestroyAck,
  RoomDestroyPayload,
  RoomDestroyedEvent,
  ReactionSendAck,
  ReactionReceivedEvent,
  ReactionSendPayload,
  RealtimeClientToServerEvents,
  RealtimeInterServerEvents,
  RealtimeServerToClientEvents,
  RealtimeSocketData,
  MatchProgressState,
  MatchView,
  MatchTransitionState,
  RoomJoinPayload,
  RoomJoinedEvent,
  RoomSeatSnapshot,
  SessionResumeAck,
  SessionResumePayload,
  SeatUpdatedEvent,
  RoomUpdatedEvent,
  SessionRecoveredEvent,
  SummaryStartedEvent,
  TrickResolvedEvent,
  WildcardRequestAck,
  WildcardRequestPayload,
  WildcardSelectAck,
  WildcardSelectPayload,
  WildcardSelectedEvent,
  WildcardSelectionRequiredEvent,
  RoomSnapshot,
} from '@dimadong/contracts';
import { RoomStoreService } from './rooms/room-store.service';

type RealtimeServer = Server<
  RealtimeClientToServerEvents,
  RealtimeServerToClientEvents,
  RealtimeInterServerEvents,
  RealtimeSocketData
>;

type RealtimeSocket = Socket<
  RealtimeClientToServerEvents,
  RealtimeServerToClientEvents,
  RealtimeInterServerEvents,
  RealtimeSocketData
>;

type RoomLifecycleState = ReturnType<RoomStoreService['getRoomLifecycleState']>;

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayDisconnect {
  constructor(private readonly roomStore: RoomStoreService) {}

  @WebSocketServer()
  server!: RealtimeServer;

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @MessageBody() payload: RoomJoinPayload,
    @ConnectedSocket() client: RealtimeSocket,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const result = await this.roomStore.connectSession(
      roomCode,
      roomSessionToken,
      client.id,
    );
    const lifecycle = this.roomStore.getRoomLifecycleState(
      roomCode,
      result.session?.seatId ?? null,
    );
    const state = this.getRoomProgressStateOrFallback(
      roomCode,
      lifecycle,
      result.snapshot,
    );
    const transition = this.getRoomTransitionStateOrFallback(
      roomCode,
      lifecycle,
      result.snapshot,
    );
    const wildcardSelection: DetailedWildcardSelectionState | null =
      lifecycle.wildcardSelectionState;
    const joinedEvent: RoomJoinedEvent = {
      roomCode,
      seatId: result.session?.seatId ?? null,
      socketId: client.id,
      snapshot: result.snapshot,
      matchView: lifecycle.matchView,
      state,
      transition,
      wildcardSelection,
    };

    client.data.roomCode = roomCode;
    client.data.roomSessionToken = roomSessionToken;
    client.data.seatId = result.session?.seatId;

    await client.join(roomCode);
    this.emitRoomState(
      roomCode,
      result.snapshot,
      this.buildRoomUpdatedEvent(
        roomCode,
        roomSessionToken,
        'room joined',
        lifecycle,
        result.snapshot,
        result.session?.seatId ?? null,
      ),
      this.buildSeatUpdatedEvent(
        roomCode,
        roomSessionToken,
        result.snapshot,
        result.session?.seatId ?? null,
      ),
    );

    return {
      event: 'room:joined',
      data: joinedEvent,
    };
  }

  @SubscribeMessage('session:resume')
  async handleSessionResume(
    @MessageBody() payload: SessionResumePayload,
    @ConnectedSocket() client: RealtimeSocket,
    @Ack() ack: (response: SessionResumeAck) => void,
  ) {
    try {
      const roomCode = this.normalizeRoomCode(payload.roomCode);
      const roomSessionToken = this.normalizeRoomSessionToken(
        payload.roomSessionToken,
      );
      const result = await this.roomStore.resumeRoom(
        roomCode,
        roomSessionToken,
      );
      const recoveredAt = new Date().toISOString();
      const lifecycle = this.roomStore.getRoomLifecycleState(
        roomCode,
        result.session?.seatId ?? client.data.seatId ?? null,
      );
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        result.snapshot,
      );
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        result.snapshot,
      );

      if (result.session) {
        await client.join(roomCode);
      }

      client.data.roomCode = roomCode;
      client.data.roomSessionToken = roomSessionToken;
      client.data.seatId = result.session?.seatId ?? client.data.seatId;

      this.emitRoomState(
        roomCode,
        result.snapshot,
        this.buildRoomUpdatedEvent(
          roomCode,
          roomSessionToken,
          'session recovered',
          lifecycle,
          result.snapshot,
          result.session?.seatId ?? client.data.seatId ?? null,
        ),
        this.buildSeatUpdatedEvent(
          roomCode,
          roomSessionToken,
          result.snapshot,
          result.session?.seatId ?? client.data.seatId ?? null,
        ),
      );
      const recoveredEvent: SessionRecoveredEvent = {
        roomCode,
        seatId: result.session?.seatId ?? client.data.seatId ?? null,
        session: result.session,
        snapshot: result.snapshot,
        matchView: result.matchView,
        state,
        transition,
        wildcardSelection: lifecycle.wildcardSelectionState,
        recoveredAt,
      };

      this.server.to(roomCode).emit('session:recovered', recoveredEvent);

      ack({
        ok: true,
        roomCode,
        session: result.session,
        data: {
          snapshot: result.snapshot,
          session: result.session,
          matchView: result.matchView,
          state,
          transition,
          wildcardSelection: lifecycle.wildcardSelectionState,
          recoveredAt,
        },
      });
    } catch (error) {
      ack({
        ok: false,
        roomCode: this.safeRoomCode(payload.roomCode),
        session: null,
        message:
          error instanceof Error
            ? error.message
            : 'Could not resume the session.',
      });
    }
  }

  @SubscribeMessage('ping')
  handlePing() {
    return {
      event: 'pong',
      data: { ok: true, timestamp: new Date().toISOString() },
    };
  }

  handleDisconnect(client: RealtimeSocket) {
    const snapshot = this.roomStore.disconnectSocket(client.id);

    if (snapshot) {
      const roomSessionToken = client.data.roomSessionToken ?? null;
      const lifecycle = this.roomStore.getRoomLifecycleState(
        snapshot.code,
        client.data.seatId ?? null,
      );
      const roomUpdated = this.buildRoomUpdatedEvent(
        snapshot.code,
        roomSessionToken,
        'disconnect',
        lifecycle,
        snapshot,
        client.data.seatId ?? null,
      );
      const seatUpdated = this.buildSeatUpdatedEvent(
        snapshot.code,
        roomSessionToken,
        snapshot,
        client.data.seatId ?? null,
      );

      this.server.to(snapshot.code).emit('room:updated', roomUpdated);
      if (seatUpdated) {
        this.server.to(snapshot.code).emit('seat:updated', seatUpdated);
      }
    }
  }

  @SubscribeMessage('lobby:toggle-ready')
  handleToggleReady(
    @MessageBody() payload: LobbyActionPayload,
    @Ack() ack: (response: { ok: boolean; message?: string }) => void,
  ) {
    try {
      const roomCode = this.normalizeRoomCode(payload.roomCode);
      const roomSessionToken = this.normalizeRoomSessionToken(
        payload.roomSessionToken,
      );
      const snapshot = this.roomStore.toggleReady(roomCode, roomSessionToken);
      const lifecycle = this.roomStore.getRoomLifecycleState(
        snapshot.code,
        this.roomStore.getSession(roomSessionToken)?.seatId ?? null,
      );
      this.emitRoomState(
        snapshot.code,
        snapshot,
        this.buildRoomUpdatedEvent(
          snapshot.code,
          roomSessionToken,
          'ready toggled',
          lifecycle,
          snapshot,
        ),
        this.buildSeatUpdatedEvent(snapshot.code, roomSessionToken, snapshot),
      );
      ack({ ok: true });
    } catch (error) {
      ack({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Could not update ready state.',
      });
    }
  }

  @SubscribeMessage('lobby:set-team')
  handleSetTeam(
    @MessageBody() payload: LobbyTeamPayload,
    @Ack() ack: (response: { ok: boolean; message?: string }) => void,
  ) {
    try {
      const roomCode = this.normalizeRoomCode(payload.roomCode);
      const roomSessionToken = this.normalizeRoomSessionToken(
        payload.roomSessionToken,
      );
      const targetSeatId = this.normalizeSeatId(
        payload.targetSeatId,
        'targetSeatId',
      );
      if (payload.teamSide !== 'A' && payload.teamSide !== 'B') {
        throw new BadRequestException('teamSide must be A or B.');
      }
      const snapshot = this.roomStore.assignTeam({
        ...payload,
        roomCode,
        roomSessionToken,
        targetSeatId,
      });
      const lifecycle = this.roomStore.getRoomLifecycleState(
        snapshot.code,
        this.roomStore.getSession(roomSessionToken)?.seatId ?? null,
      );
      this.emitRoomState(
        snapshot.code,
        snapshot,
        this.buildRoomUpdatedEvent(
          snapshot.code,
          roomSessionToken,
          'team changed',
          lifecycle,
          snapshot,
        ),
        this.buildSeatUpdatedEvent(snapshot.code, roomSessionToken, snapshot),
      );
      ack({ ok: true });
    } catch (error) {
      ack({
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not update teams.',
      });
    }
  }

  @SubscribeMessage('match:start')
  handleStartMatch(
    @MessageBody() payload: LobbyActionPayload,
    @Ack() ack: (response: { ok: boolean; message?: string }) => void,
  ) {
    try {
      const roomCode = this.normalizeRoomCode(payload.roomCode);
      const roomSessionToken = this.normalizeRoomSessionToken(
        payload.roomSessionToken,
      );
      const snapshot = this.roomStore.startMatch(roomCode, roomSessionToken);
      const lifecycle = this.roomStore.getRoomLifecycleState(
        snapshot.code,
        this.roomStore.getSession(roomSessionToken)?.seatId ?? null,
      );
      this.emitRoomState(
        snapshot.code,
        snapshot,
        this.buildRoomUpdatedEvent(
          snapshot.code,
          roomSessionToken,
          'match started',
          lifecycle,
          snapshot,
        ),
        this.buildSeatUpdatedEvent(snapshot.code, roomSessionToken, snapshot),
      );
      ack({ ok: true });
    } catch (error) {
      ack({
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not start the match.',
      });
    }
  }

  @SubscribeMessage('summary:start')
  handleSummaryStart(
    @MessageBody() payload: SummaryStartPayload,
    @Ack() ack: (response: SummaryStartAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientActionId = this.normalizeClientActionId(payload.clientActionId);
    const source =
      payload.source === 'manual' ||
      payload.source === 'match_end' ||
      payload.source === 'reconnect'
        ? payload.source
        : 'manual';
    const startedAt = new Date().toISOString();

    try {
      const result = this.roomStore.startSummaryWithResult(
        roomCode,
        roomSessionToken,
        source,
      );
      const snapshot = result.snapshot;
      const lifecycle = result.lifecycle;
      const matchView = lifecycle.matchView;
      const summary = matchView?.summary;
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );

      if (!summary || !result.summaryStarted) {
        throw new Error('Summary is not available for this room.');
      }

      this.emitRoomState(
        roomCode,
        snapshot,
        this.buildRoomUpdatedEvent(
          roomCode,
          roomSessionToken,
          'summary started',
          lifecycle,
          snapshot,
        ),
        this.buildSeatUpdatedEvent(roomCode, roomSessionToken, snapshot),
      );
      this.server.to(roomCode).emit('summary:started', {
        roomCode,
        summary,
        handNumber: matchView?.handNumber ?? 0,
        startedAt,
        source: result.source,
        statusText: snapshot.statusText,
        transition,
        state,
        snapshot,
        matchView,
      } satisfies SummaryStartedEvent);

      ack({
        ok: true,
        roomCode,
        clientActionId,
        source: result.source,
        startedAt,
        data: {
          roomCode,
          clientActionId,
          source: result.source,
          startedAt,
          snapshot,
          matchView,
          summary,
          state,
          transition,
        },
      });
    } catch (error) {
      ack({
        ok: false,
        roomCode,
        clientActionId,
        source,
        startedAt,
        message:
          error instanceof Error
            ? error.message
            : 'Could not start the summary.',
      });
    }
  }

  @SubscribeMessage('game:play-card')
  handlePlayCard(
    @MessageBody() payload: PlayCardPayload,
    @Ack() ack: (response: { ok: boolean; message?: string }) => void,
  ) {
    try {
      const roomCode = this.normalizeRoomCode(payload.roomCode);
      const roomSessionToken = this.normalizeRoomSessionToken(
        payload.roomSessionToken,
      );
      const cardId = this.normalizeCardId(payload.cardId);
      const result = this.roomStore.playCardWithResult({
        ...payload,
        roomCode,
        roomSessionToken,
        cardId,
      });
      const snapshot = result.snapshot;
      const lifecycle = result.lifecycle;
      const matchView = lifecycle.matchView;
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const handTrickWins = state.handTrickWins;
      const resolvedAt = new Date().toISOString();
      const latestTrickResult = transition.latestTrickResult;
      const trickTableCards =
        result.resolvedTableCards?.map((play) => ({
          seatId: play.seatId,
          displayName:
            snapshot.seats.find((seat) => seat.id === play.seatId)
              ?.displayName ?? null,
          card: play.card,
        })) ?? state.tableCards;
      const trickResolvedEvent: TrickResolvedEvent = {
        roomCode: snapshot.code,
        handNumber: state.handNumber,
        trickNumber: state.trickNumber,
        dealerSeatId: state.dealerSeatId,
        currentTurnSeatId: state.currentTurnSeatId,
        handTrickWins,
        winnerSeatId: latestTrickResult?.winnerSeatId ?? null,
        winnerTeamSide: latestTrickResult?.winnerTeamSide ?? null,
        winningCardLabel:
          latestTrickResult?.winningCardLabel ??
          trickTableCards[0]?.card.label ??
          null,
        tableCards: trickTableCards,
        resolvedTricks: state.resolvedTricks,
        resolvedAt: transition.latestTrickResolvedAt ?? resolvedAt,
        nextTurnSeatId: state.currentTurnSeatId,
        handComplete: transition.handComplete,
        score: state.score,
        statusText: state.statusText,
        turnDeadlineAt: state.turnDeadlineAt,
        reconnectDeadlineAt: state.reconnectDeadlineAt,
        transition,
        state,
        snapshot,
        matchView,
      };

      this.emitRoomState(
        snapshot.code,
        snapshot,
        this.buildRoomUpdatedEvent(
          snapshot.code,
          roomSessionToken,
          'card played',
          lifecycle,
          snapshot,
        ),
        this.buildSeatUpdatedEvent(snapshot.code, roomSessionToken, snapshot),
      );
      if (result.trickResolved) {
        this.server
          .to(snapshot.code)
          .emit('trick:resolved', trickResolvedEvent);
      }

      if (result.handScored) {
        const scoredAt = resolvedAt;
        this.server.to(snapshot.code).emit('hand:scored', {
          roomCode: snapshot.code,
          handNumber: state.handNumber,
          dealerSeatId: state.dealerSeatId,
          currentTurnSeatId: state.currentTurnSeatId,
          handTrickWins,
          handWinnerTeamSide: transition.lastHandWinnerTeamSide,
          tableCards: state.tableCards,
          resolvedTricks: state.resolvedTricks,
          score: state.score,
          scoredAt: transition.lastHandScoredAt ?? scoredAt,
          statusText: state.statusText,
          turnDeadlineAt: state.turnDeadlineAt,
          reconnectDeadlineAt: state.reconnectDeadlineAt,
          transition,
          state,
          snapshot,
          matchView,
          summary: matchView?.summary ?? null,
        } satisfies HandScoredEvent);
      }

      if (result.summaryStarted && matchView?.summary) {
        this.server.to(snapshot.code).emit('summary:started', {
          roomCode: snapshot.code,
          summary: matchView.summary,
          handNumber: state.handNumber,
          startedAt: transition.lastHandScoredAt ?? resolvedAt,
          source: 'match_end',
          statusText: state.statusText,
          transition,
          state,
          snapshot,
          matchView,
        } satisfies SummaryStartedEvent);
      }

      ack({ ok: true });
    } catch (error) {
      ack({
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not play card.',
      });
    }
  }

  @SubscribeMessage('wildcard:request')
  handleWildcardRequest(
    @MessageBody() payload: WildcardRequestPayload,
    @Ack() ack: (response: WildcardRequestAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientActionId = this.normalizeClientActionId(payload.clientActionId);
    const cardId = this.normalizeCardId(payload.cardId);
    const requestedAt = new Date().toISOString();
    const session = this.roomStore.getSession(roomSessionToken);
    let lifecycle = this.roomStore.getRoomLifecycleState(
      roomCode,
      session?.seatId ?? null,
    );

    try {
      const snapshot = this.roomStore.requestWildcardSelection(
        roomCode,
        roomSessionToken,
        cardId,
      );
      lifecycle = this.roomStore.getRoomLifecycleState(
        roomCode,
        session?.seatId ?? null,
      );
      const matchView = lifecycle.matchView;
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const selection = lifecycle.wildcardSelectionState;
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );

      if (!selection) {
        throw new Error('Wildcard selection state could not be resolved.');
      }

      const event: WildcardSelectionRequiredEvent = {
        roomCode,
        seatId: session?.seatId ?? '',
        cardId,
        handNumber: state?.handNumber ?? 0,
        requestedAt,
        selectionDeadlineAt: selection.selectionDeadlineAt,
        selection,
        state,
        transition,
        snapshot,
        matchView,
        reason: snapshot.statusText,
      };

      this.server.to(roomCode).emit('wildcard:selection-required', event);

      ack({
        ok: true,
        roomCode,
        clientActionId,
        cardId,
        accepted: true,
        queued: false,
        data: {
          clientActionId,
          cardId,
          requestedAt,
          accepted: true,
          queued: false,
          selection,
          state,
          transition,
          snapshot,
          matchView,
        },
      });
    } catch (error) {
      const snapshot = this.safeSnapshot(roomCode);
      ack({
        ok: false,
        roomCode,
        clientActionId,
        cardId,
        accepted: false,
        queued: false,
        message:
          error instanceof Error
            ? error.message
            : 'Could not request wildcard selection.',
        data: {
          clientActionId,
          cardId,
          requestedAt,
          accepted: false,
          queued: false,
          selection: null,
          state: snapshot
            ? this.getRoomProgressState(roomCode, lifecycle, snapshot)
            : lifecycle.progressState,
          transition: this.getRoomTransitionState(roomCode, lifecycle),
          snapshot,
          matchView: lifecycle.matchView,
          reason:
            error instanceof Error
              ? error.message
              : 'Could not request wildcard selection.',
        },
      });
    }
  }

  @SubscribeMessage('canto:open')
  handleCantoOpen(
    @MessageBody() payload: CantoOpenPayload,
    @Ack() ack: (response: CantoOpenAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientActionId = this.normalizeClientActionId(payload.clientActionId);
    const cantoType = this.normalizeCantoType(payload.cantoType);
    const session = this.roomStore.getSession(roomSessionToken);
    const targetSeatId = payload.targetSeatId
      ? this.normalizeSeatId(payload.targetSeatId, 'targetSeatId')
      : null;
    const openedAt = new Date().toISOString();
    try {
      const snapshot = this.roomStore.openCanto(
        roomCode,
        roomSessionToken,
        cantoType,
        targetSeatId,
      );
      const lifecycle = this.roomStore.getRoomLifecycleState(
        roomCode,
        session?.seatId ?? null,
      );
      const matchView = lifecycle.matchView;
      const responseDeadlineAt = new Date(Date.now() + 12_000).toISOString();
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const event: CantoOpenedEvent = {
        roomCode,
        seatId: session?.seatId ?? null,
        actorSeatId: session?.seatId ?? null,
        clientActionId,
        cantoType,
        statusText: snapshot.statusText,
        openedAt,
        responseDeadlineAt,
        targetSeatId,
        state,
        transition,
        snapshot,
        matchView,
      };

      this.server.to(roomCode).emit('canto:opened', event);

      ack({
        ok: true,
        roomCode,
        clientActionId,
        cantoType,
        targetSeatId,
        accepted: true,
        queued: false,
        data: {
          clientActionId,
          cantoType,
          targetSeatId,
          accepted: true,
          queued: false,
          openedAt,
          responseDeadlineAt,
          statusText: snapshot.statusText,
          state,
          transition,
          snapshot,
          matchView,
        },
      });
    } catch (error) {
      const errorSnapshot = this.safeSnapshot(roomCode);
      const errorLifecycle = this.roomStore.getRoomLifecycleState(
        roomCode,
        session?.seatId ?? null,
      );
      ack({
        ok: false,
        roomCode,
        clientActionId,
        cantoType,
        targetSeatId,
        accepted: false,
        queued: false,
        message:
          error instanceof Error ? error.message : 'Could not open canto.',
        data: {
          clientActionId,
          cantoType,
          targetSeatId,
          accepted: false,
          queued: false,
          openedAt,
          responseDeadlineAt: null,
          statusText:
            error instanceof Error ? error.message : 'Could not open canto.',
          state: errorSnapshot
            ? this.getRoomProgressState(roomCode, errorLifecycle, errorSnapshot)
            : errorLifecycle.progressState,
          transition: this.getRoomTransitionState(roomCode, errorLifecycle),
          snapshot: errorSnapshot,
          matchView: errorLifecycle.matchView,
          reason:
            error instanceof Error ? error.message : 'Could not open canto.',
        },
      });
    }
  }

  @SubscribeMessage('canto:resolve')
  handleCantoResolve(
    @MessageBody() payload: CantoResolvePayload,
    @Ack() ack: (response: CantoResolveAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientActionId = this.normalizeClientActionId(payload.clientActionId);
    const cantoType = this.normalizeCantoType(payload.cantoType);
    const cantoResponse = this.normalizeCantoResponse(payload.response);
    const session = this.roomStore.getSession(roomSessionToken);
    const targetSeatId = payload.targetSeatId
      ? this.normalizeSeatId(payload.targetSeatId, 'targetSeatId')
      : null;
    const resolvedAt = new Date().toISOString();
    const beforeSnapshot = this.safeSnapshot(roomCode);
    const beforeLifecycle = this.roomStore.getRoomLifecycleState(
      roomCode,
      session?.seatId ?? null,
    );
    const beforeState = beforeLifecycle.progressState;

    try {
      const result = this.roomStore.resolveCantoWithResult(
        roomCode,
        roomSessionToken,
        cantoResponse,
      );
      const snapshot = result.snapshot;
      const lifecycle = result.lifecycle;
      const matchView = lifecycle.matchView;
      const scoreDelta = result.scoreDelta;
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const event: CantoResolvedEvent = {
        roomCode,
        seatId: session?.seatId ?? null,
        actorSeatId: session?.seatId ?? null,
        clientActionId,
        cantoType,
        result: cantoResponse,
        scoreDelta,
        statusText: snapshot.statusText,
        resolvedAt,
        targetSeatId,
        state,
        transition,
        snapshot,
        matchView,
      };

      this.server.to(roomCode).emit('canto:resolved', event);

      if (result.matchEnded && matchView?.summary) {
        this.server.to(roomCode).emit('summary:started', {
          roomCode,
          summary: matchView.summary,
          handNumber: matchView.handNumber,
          startedAt:
            result.lifecycle.transitionState?.lastHandScoredAt ?? resolvedAt,
          source: 'match_end',
          statusText: snapshot.statusText,
          transition,
          state,
          snapshot,
          matchView,
        } satisfies SummaryStartedEvent);
      }

      ack({
        ok: true,
        roomCode,
        clientActionId,
        cantoType,
        response: cantoResponse,
        targetSeatId,
        accepted: true,
        queued: false,
        data: {
          clientActionId,
          cantoType,
          response: cantoResponse,
          targetSeatId,
          accepted: true,
          queued: false,
          resolvedAt,
          scoreDelta,
          statusText: snapshot.statusText,
          state,
          transition,
          snapshot,
          matchView,
        },
      });
    } catch (error) {
      ack({
        ok: false,
        roomCode,
        clientActionId,
        cantoType,
        response: cantoResponse,
        targetSeatId,
        accepted: false,
        queued: false,
        message:
          error instanceof Error ? error.message : 'Could not resolve canto.',
        data: {
          clientActionId,
          cantoType,
          response: cantoResponse,
          targetSeatId,
          accepted: false,
          queued: false,
          resolvedAt,
          scoreDelta: { A: 0, B: 0 },
          statusText:
            error instanceof Error ? error.message : 'Could not resolve canto.',
          snapshot: beforeSnapshot,
          matchView: beforeLifecycle.matchView,
          state: beforeState,
          transition: beforeLifecycle.transitionState,
          reason:
            error instanceof Error ? error.message : 'Could not resolve canto.',
        },
      });
    }
  }

  @SubscribeMessage('wildcard:select')
  handleWildcardSelect(
    @MessageBody() payload: WildcardSelectPayload,
    @Ack() ack: (response: WildcardSelectAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientActionId = this.normalizeClientActionId(payload.clientActionId);
    const cardId = this.normalizeCardId(payload.cardId);
    const selectedLabel = this.normalizeWildcardLabel(
      payload.selectedLabel,
      'selectedLabel',
    );
    const session = this.roomStore.getSession(roomSessionToken);
    const selectedAt = new Date().toISOString();
    const lifecycleBeforeSelect = this.roomStore.getRoomLifecycleState(
      roomCode,
      session?.seatId ?? null,
    );
    const pendingSelection = lifecycleBeforeSelect.wildcardSelectionState;
    try {
      const snapshot = this.roomStore.selectWildcard(
        roomCode,
        roomSessionToken,
        cardId,
        selectedLabel,
      );
      const lifecycle = this.roomStore.getRoomLifecycleState(
        roomCode,
        session?.seatId ?? null,
      );
      const matchView = lifecycle.matchView;
      const selectedCard =
        lifecycleBeforeSelect.matchView?.yourHand.find(
          (card) => card.id === cardId,
        ) ?? null;

      if (!selectedCard) {
        throw new Error('Wildcard card could not be resolved after selection.');
      }

      const selection = pendingSelection
        ? {
            ...pendingSelection,
            selectedLabel,
          }
        : null;

      if (!selection) {
        throw new Error('Wildcard selection state could not be resolved.');
      }
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );

      const event: WildcardSelectedEvent = {
        roomCode,
        seatId: session?.seatId ?? '',
        cardId,
        handNumber: matchView?.handNumber ?? 0,
        selectedCard,
        selectedLabel,
        selectedAt,
        accepted: true,
        selection,
        state,
        transition,
        snapshot,
        matchView,
      };

      this.server.to(roomCode).emit('wildcard:selected', event);

      ack({
        ok: true,
        roomCode,
        clientActionId,
        cardId,
        accepted: true,
        queued: false,
        data: {
          clientActionId,
          cardId,
          selectedLabel,
          selectedAt,
          accepted: true,
          queued: false,
          selection,
          state,
          transition,
          snapshot,
          matchView,
        },
      });
    } catch (error) {
      ack({
        ok: false,
        roomCode,
        clientActionId,
        cardId,
        accepted: false,
        queued: false,
        message:
          error instanceof Error ? error.message : 'Could not select wildcard.',
        data: {
          clientActionId,
          cardId,
          selectedLabel,
          selectedAt,
          accepted: false,
          queued: false,
          selection: pendingSelection,
          state: this.getRoomProgressState(
            roomCode,
            lifecycleBeforeSelect,
            this.safeSnapshot(roomCode),
          ),
          transition: this.getRoomTransitionState(
            roomCode,
            lifecycleBeforeSelect,
          ),
          snapshot: this.safeSnapshot(roomCode),
          matchView: lifecycleBeforeSelect.matchView,
          reason:
            error instanceof Error
              ? error.message
              : 'Could not select wildcard.',
        },
      });
    }
  }

  @SubscribeMessage('action:submit')
  handleActionSubmit(
    @MessageBody() payload: ActionSubmitPayload,
    @Ack() ack: (response: ActionSubmitAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientActionId = this.normalizeClientActionId(payload.clientActionId);
    const actionType = this.normalizeActionType(payload.actionType);
    const actionPayload = this.normalizeActionPayload(payload.payload);
    if (!actionPayload || typeof actionPayload !== 'object') {
      throw new BadRequestException('payload is required.');
    }
    const session = this.roomStore.getSession(roomSessionToken);
    try {
      const snapshot = this.roomStore.submitAction({
        ...payload,
        roomCode,
        roomSessionToken,
        clientActionId,
        actionType,
        payload: actionPayload,
      });
      const lifecycle = this.roomStore.getRoomLifecycleState(
        roomCode,
        session?.seatId ?? null,
      );
      const matchView = lifecycle.matchView;
      const state = this.getRoomProgressStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const transition = this.getRoomTransitionStateOrFallback(
        roomCode,
        lifecycle,
        snapshot,
      );
      const wildcardSelection = lifecycle.wildcardSelectionState;

      const event: ActionSubmittedEvent = {
        roomCode,
        clientActionId,
        actionType,
        actorSeatId: session?.seatId ?? null,
        payload: actionPayload,
        accepted: true,
        state,
        transition,
        wildcardSelection,
        snapshot,
        matchView,
      };

      this.server.to(roomCode).emit('action:submitted', event);
      this.emitRoomState(
        roomCode,
        snapshot,
        this.buildRoomUpdatedEvent(
          roomCode,
          roomSessionToken,
          `action submitted: ${actionType}`,
          lifecycle,
          snapshot,
        ),
        this.buildSeatUpdatedEvent(roomCode, roomSessionToken, snapshot),
      );

      ack({
        ok: true,
        roomCode,
        actionType,
        clientActionId,
        accepted: true,
        queued: false,
        data: {
          clientActionId,
          actionType,
          accepted: true,
          queued: false,
          state,
          transition,
          wildcardSelection,
          snapshot,
          matchView,
        },
      });
    } catch (error) {
      const snapshot = this.safeSnapshot(roomCode);
      const lifecycle = this.roomStore.getRoomLifecycleState(
        roomCode,
        session?.seatId ?? null,
      );
      const matchView = lifecycle.matchView;
      const state = this.getRoomProgressState(roomCode, lifecycle, snapshot);
      const transition = this.getRoomTransitionState(roomCode, lifecycle);
      const wildcardSelection = lifecycle.wildcardSelectionState;
      const reason =
        error instanceof Error ? error.message : 'Could not submit the action.';
      const rejectedEvent: ActionRejectedEvent = {
        roomCode,
        clientActionId,
        actionType,
        message: reason,
        state,
        transition,
        wildcardSelection,
        snapshot,
        matchView,
        reason,
      };

      this.server.to(roomCode).emit('action:rejected', rejectedEvent);

      ack({
        ok: false,
        roomCode,
        actionType,
        clientActionId,
        accepted: false,
        queued: false,
        message: reason,
        data: {
          clientActionId,
          actionType,
          accepted: false,
          queued: false,
          state,
          transition,
          wildcardSelection,
          snapshot,
          matchView,
          reason,
        },
      });
    }
  }

  @SubscribeMessage('chat:send')
  handleChatSend(
    @MessageBody() payload: ChatSendPayload,
    @Ack() ack: (response: ChatSendAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientMessageId = this.normalizeClientActionId(
      payload.clientMessageId,
    );
    const message = this.normalizeChatMessage(payload.message);
    const session = this.roomStore.getSession(roomSessionToken);

    if (!session) {
      ack({
        ok: false,
        roomCode,
        clientMessageId,
        accepted: false,
        queued: false,
        message: 'Session not found.',
      });
      return;
    }

    const snapshot = this.safeSnapshot(roomCode);
    const lifecycle = this.roomStore.getRoomLifecycleState(
      roomCode,
      session.seatId,
    );
    const matchView = lifecycle.matchView;
    const state = this.getRoomProgressState(roomCode, lifecycle, snapshot);
    const event: ChatReceivedEvent = {
      roomCode,
      clientMessageId,
      seatId: session.seatId,
      message,
      accepted: true,
      state,
      snapshot,
      matchView,
    };

    this.server.to(roomCode).emit('chat:received', event);

    ack({
      ok: true,
      roomCode,
      clientMessageId,
      accepted: true,
      queued: false,
      data: {
        clientMessageId,
        accepted: true,
        queued: false,
        state,
        snapshot,
        matchView,
      },
    });
  }

  @SubscribeMessage('reaction:send')
  handleReactionSend(
    @MessageBody() payload: ReactionSendPayload,
    @Ack() ack: (response: ReactionSendAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const clientReactionId = this.normalizeClientActionId(
      payload.clientReactionId,
    );
    const reaction = this.normalizeReaction(payload.reaction);
    const targetSeatId = payload.targetSeatId
      ? this.normalizeSeatId(payload.targetSeatId, 'targetSeatId')
      : null;
    const session = this.roomStore.getSession(roomSessionToken);

    if (!session) {
      ack({
        ok: false,
        roomCode,
        clientReactionId,
        targetSeatId,
        accepted: false,
        queued: false,
        message: 'Session not found.',
      });
      return;
    }

    const snapshot = this.safeSnapshot(roomCode);
    const lifecycle = this.roomStore.getRoomLifecycleState(
      roomCode,
      session.seatId,
    );
    const matchView = lifecycle.matchView;
    const state = this.getRoomProgressState(roomCode, lifecycle, snapshot);
    const event: ReactionReceivedEvent = {
      roomCode,
      clientReactionId,
      seatId: session.seatId,
      targetSeatId,
      reaction,
      accepted: true,
      state,
      snapshot,
      matchView,
    };

    this.server.to(roomCode).emit('reaction:received', event);

    ack({
      ok: true,
      roomCode,
      clientReactionId,
      targetSeatId,
      accepted: true,
      queued: false,
      data: {
        clientReactionId,
        targetSeatId,
        accepted: true,
        queued: false,
        state,
        snapshot,
        matchView,
      },
    });
  }

  @SubscribeMessage('seat:free')
  handleSeatFree(
    @MessageBody() payload: SeatFreePayload,
    @Ack() ack: (response: SeatFreeAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const targetSeatId = this.normalizeSeatId(
      payload.targetSeatId,
      'targetSeatId',
    );
    const freedAt = new Date().toISOString();

    try {
      const snapshot = this.roomStore.freeSeat(
        roomCode,
        roomSessionToken,
        targetSeatId,
      );
      const lifecycle = this.roomStore.getRoomLifecycleState(roomCode, null);
      const result: SeatFreeResult = {
        roomCode,
        targetSeatId,
        freedAt,
        snapshot,
      };

      this.emitRoomState(
        roomCode,
        snapshot,
        this.buildRoomUpdatedEvent(
          roomCode,
          roomSessionToken,
          'seat freed',
          lifecycle,
          snapshot,
          null,
        ),
        null,
      );

      ack({
        ok: true,
        roomCode,
        targetSeatId,
        data: result,
      });
    } catch (error) {
      ack({
        ok: false,
        roomCode,
        targetSeatId,
        message:
          error instanceof Error ? error.message : 'Could not free the seat.',
      });
    }
  }

  @SubscribeMessage('room:destroy')
  handleRoomDestroy(
    @MessageBody() payload: RoomDestroyPayload,
    @Ack() ack: (response: RoomDestroyAck) => void,
  ) {
    const roomCode = this.normalizeRoomCode(payload.roomCode);
    const roomSessionToken = this.normalizeRoomSessionToken(
      payload.roomSessionToken,
    );
    const session = this.roomStore.getSession(roomSessionToken);
    const destroyedAt = new Date().toISOString();
    const lifecycleBeforeDestroy = this.roomStore.getRoomLifecycleState(
      roomCode,
      session?.seatId ?? null,
    );
    const matchViewBeforeDestroy = lifecycleBeforeDestroy.matchView;
    const beforeSnapshot = this.safeSnapshot(roomCode);
    const stateBeforeDestroy = beforeSnapshot
      ? this.getRoomProgressStateOrFallback(
          roomCode,
          lifecycleBeforeDestroy,
          beforeSnapshot,
        )
      : lifecycleBeforeDestroy.progressState;
    const transitionBeforeDestroy = beforeSnapshot
      ? this.getRoomTransitionStateOrFallback(
          roomCode,
          lifecycleBeforeDestroy,
          beforeSnapshot,
        )
      : this.getRoomTransitionState(roomCode, lifecycleBeforeDestroy);
    const wildcardSelectionBeforeDestroy =
      lifecycleBeforeDestroy.wildcardSelectionState;

    try {
      const snapshot = this.roomStore.destroyRoom(
        roomCode,
        roomSessionToken,
        payload.reason,
      );
      const event: RoomDestroyedEvent = {
        roomCode,
        roomId: snapshot.roomId,
        destroyed: true,
        snapshot,
        matchView: matchViewBeforeDestroy,
        destroyedAt,
        destroyedBySeatId: session?.seatId ?? null,
        state: stateBeforeDestroy,
        transition: transitionBeforeDestroy,
        wildcardSelection: wildcardSelectionBeforeDestroy,
        reason: payload.reason ?? 'Host ended the room.',
      };

      this.server.to(roomCode).emit('room:destroyed', event);

      ack({
        ok: true,
        roomCode,
        roomId: snapshot.roomId,
        destroyed: true,
        data: {
          roomCode,
          roomId: snapshot.roomId,
          destroyed: true,
          destroyedAt,
          destroyedBySeatId: session?.seatId ?? null,
          state: stateBeforeDestroy,
          transition: transitionBeforeDestroy,
          wildcardSelection: wildcardSelectionBeforeDestroy,
          snapshot,
          matchView: matchViewBeforeDestroy,
          reason: payload.reason ?? 'Host ended the room.',
        },
      });
    } catch (error) {
      ack({
        ok: false,
        roomCode,
        roomId: session?.roomId ?? null,
        destroyed: false,
        message:
          error instanceof Error
            ? error.message
            : 'Could not destroy the room.',
        data: {
          roomCode,
          roomId: session?.roomId ?? null,
          destroyed: false,
          destroyedAt,
          destroyedBySeatId: session?.seatId ?? null,
          state: stateBeforeDestroy,
          transition: transitionBeforeDestroy,
          wildcardSelection: wildcardSelectionBeforeDestroy,
          snapshot: null,
          matchView: matchViewBeforeDestroy,
          reason: payload.reason ?? 'Could not destroy the room.',
        },
      });
    }
  }

  private emitRoomState(
    roomCode: string,
    snapshot: ReturnType<RoomStoreService['getSnapshot']>,
    roomUpdated: RoomUpdatedEvent,
    seatUpdated: SeatUpdatedEvent | null,
  ) {
    this.server.to(roomCode).emit('room:updated', roomUpdated);

    if (seatUpdated) {
      this.server.to(roomCode).emit('seat:updated', seatUpdated);
    }
  }

  private buildRoomUpdatedEvent(
    roomCode: string,
    roomSessionToken?: string | null,
    reason?: string,
    lifecycleOverride?: RoomLifecycleState | null,
    snapshotOverride?: RoomSnapshot,
    seatIdFallback?: string | null,
  ): RoomUpdatedEvent {
    const snapshot = snapshotOverride ?? this.roomStore.getSnapshot(roomCode);
    const seatId =
      seatIdFallback ??
      (roomSessionToken
        ? this.roomStore.getSession(roomSessionToken)?.seatId
        : null) ??
      null;
    const lifecycle =
      lifecycleOverride ??
      this.roomStore.getRoomLifecycleState(roomCode, seatId);
    const transition = this.getRoomTransitionStateOrFallback(
      roomCode,
      lifecycle,
      snapshot,
    );

    return {
      roomCode,
      snapshot,
      matchView: lifecycle.matchView,
      state: this.getRoomProgressStateOrFallback(roomCode, lifecycle, snapshot),
      transition,
      wildcardSelection: lifecycle.wildcardSelectionState,
      reason,
    };
  }

  private buildSeatUpdatedEvent(
    roomCode: string,
    roomSessionToken?: string | null,
    snapshotOverride?: RoomSnapshot,
    seatIdFallback?: string | null,
  ): SeatUpdatedEvent | null {
    const session = roomSessionToken
      ? this.roomStore.getSession(roomSessionToken)
      : null;
    const seatId = seatIdFallback ?? session?.seatId ?? null;

    if (!seatId) {
      return null;
    }

    const seat = this.getSeatSnapshot(
      roomCode,
      roomSessionToken,
      snapshotOverride,
      seatId,
    );

    return seat
      ? {
          roomCode,
          seat,
        }
      : null;
  }

  private getSeatSnapshot(
    roomCode: string,
    roomSessionToken?: string | null,
    snapshotOverride?: RoomSnapshot,
    seatIdFallback?: string | null,
  ): RoomSeatSnapshot | null {
    const snapshot = snapshotOverride ?? this.roomStore.getSnapshot(roomCode);
    const session = roomSessionToken
      ? this.roomStore.getSession(roomSessionToken)
      : null;
    const seatId = seatIdFallback ?? session?.seatId ?? null;

    if (!seatId) {
      return null;
    }

    return snapshot.seats.find((seat) => seat.id === seatId) ?? null;
  }

  private safeSnapshot(roomCode: string) {
    try {
      return this.roomStore.getSnapshot(roomCode);
    } catch {
      return null;
    }
  }

  private buildMatchProgressState(
    snapshot: RoomSnapshot | null,
    matchView: MatchView | null,
  ): MatchProgressState | null {
    if (!snapshot || !matchView) {
      return null;
    }

    return {
      phase: snapshot.phase,
      handNumber: matchView.handNumber,
      trickNumber: matchView.trickNumber,
      dealerSeatId: matchView.dealerSeatId,
      currentTurnSeatId: matchView.currentTurnSeatId,
      handTrickWins: this.countTrickWins(matchView.trickResults),
      tableCards: matchView.tableCards,
      resolvedTricks: matchView.trickResults,
      score: snapshot.score,
      statusText: snapshot.statusText,
      turnDeadlineAt: snapshot.turnDeadlineAt,
      reconnectDeadlineAt: snapshot.reconnectDeadlineAt,
      summary: matchView.summary,
    };
  }

  private buildFallbackMatchProgressState(
    snapshot: RoomSnapshot,
    matchView: MatchView | null,
  ): MatchProgressState {
    return {
      phase: snapshot.phase,
      handNumber: matchView?.handNumber ?? 0,
      trickNumber: matchView?.trickNumber ?? 0,
      dealerSeatId: matchView?.dealerSeatId ?? null,
      currentTurnSeatId: matchView?.currentTurnSeatId ?? null,
      handTrickWins: matchView
        ? this.countTrickWins(matchView.trickResults)
        : { A: 0, B: 0 },
      tableCards: matchView?.tableCards ?? [],
      resolvedTricks: matchView?.trickResults ?? [],
      score: snapshot.score,
      statusText: snapshot.statusText,
      turnDeadlineAt: snapshot.turnDeadlineAt,
      reconnectDeadlineAt: snapshot.reconnectDeadlineAt,
      summary: matchView?.summary ?? null,
    };
  }

  private buildFallbackMatchTransitionState(
    snapshot: RoomSnapshot,
    matchView: MatchView | null,
  ): MatchTransitionState {
    const latestTrickResult =
      matchView?.trickResults[matchView.trickResults.length - 1] ?? null;
    const handComplete =
      snapshot.phase === 'hand_scoring' ||
      snapshot.phase === 'post_match_summary';
    const matchComplete =
      snapshot.phase === 'match_end' || snapshot.phase === 'post_match_summary';
    const handSummaryScore = handComplete ? snapshot.score : null;
    const matchSummaryScore = matchComplete ? snapshot.score : null;
    const winnerTeamSide =
      matchView?.summary?.winnerTeamSide ?? snapshot.winnerTeamSide ?? null;

    return {
      phaseDetail: snapshot.statusText,
      activeActionSeatId: matchView?.currentTurnSeatId ?? null,
      latestTrickResult,
      latestTrickResolvedAt:
        snapshot.phase === 'trick_resolution' ? snapshot.turnDeadlineAt : null,
      trickResult: {
        state: latestTrickResult ? 'resolved' : 'idle',
        resolvedAt:
          snapshot.phase === 'trick_resolution'
            ? snapshot.turnDeadlineAt
            : null,
        winnerSeatId: latestTrickResult?.winnerSeatId ?? null,
        winnerTeamSide: latestTrickResult?.winnerTeamSide ?? null,
        winningCardLabel: latestTrickResult?.winningCardLabel ?? null,
      },
      handComplete,
      lastHandScoredAt: handComplete ? snapshot.turnDeadlineAt : null,
      lastHandWinnerTeamSide: winnerTeamSide,
      handSummary: {
        state: handComplete ? 'resolved' : 'idle',
        resolvedAt: handComplete ? snapshot.turnDeadlineAt : null,
        finalScore: handSummaryScore,
        winnerTeamSide,
        reason: winnerTeamSide ? `Team ${winnerTeamSide} won the hand.` : null,
      },
      matchComplete,
      winnerTeamSide,
      matchSummary: {
        state: matchComplete ? 'resolved' : 'idle',
        resolvedAt: matchComplete ? snapshot.turnDeadlineAt : null,
        finalScore: matchSummaryScore,
        winnerTeamSide,
        reason: winnerTeamSide ? `Team ${winnerTeamSide} won the match.` : null,
      },
    };
  }

  private getRoomTransitionState(
    roomCode: string,
    lifecycle: RoomLifecycleState,
  ): MatchTransitionState | null {
    return (
      lifecycle.transitionState ??
      this.roomStore.getMatchTransitionState(roomCode)
    );
  }

  private getRoomTransitionStateOrFallback(
    roomCode: string,
    lifecycle: RoomLifecycleState,
    snapshot: RoomSnapshot,
  ): MatchTransitionState {
    return (
      lifecycle.transitionState ??
      this.roomStore.getMatchTransitionState(roomCode) ??
      this.buildFallbackMatchTransitionState(snapshot, lifecycle.matchView)
    );
  }

  private getRoomProgressState(
    roomCode: string,
    lifecycle: RoomLifecycleState,
    snapshot: RoomSnapshot | null,
  ): MatchProgressState | null {
    return (
      lifecycle.progressState ??
      this.roomStore.getMatchProgressState(roomCode) ??
      (snapshot
        ? this.buildFallbackMatchProgressState(snapshot, lifecycle.matchView)
        : null)
    );
  }

  private getRoomProgressStateOrFallback(
    roomCode: string,
    lifecycle: RoomLifecycleState,
    snapshot: RoomSnapshot,
  ): MatchProgressState {
    return (
      lifecycle.progressState ??
      this.roomStore.getMatchProgressState(roomCode) ??
      this.buildFallbackMatchProgressState(snapshot, lifecycle.matchView)
    );
  }

  private normalizeRoomCode(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length !== 6) {
      throw new BadRequestException('roomCode is required.');
    }

    return value.trim().toUpperCase();
  }

  private normalizeRoomSessionToken(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('roomSessionToken is required.');
    }

    return value.trim();
  }

  private normalizeSeatId(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private normalizeClientActionId(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('clientActionId is required.');
    }

    return value.trim();
  }

  private normalizeCardId(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('cardId is required.');
    }

    return value.trim();
  }

  private normalizeChatMessage(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('message is required.');
    }

    const message = value.trim();
    if (message.length === 0 || message.length > 200) {
      throw new BadRequestException('message must be between 1 and 200 chars.');
    }

    return message;
  }

  private normalizeReaction(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('reaction is required.');
    }

    const reaction = value.trim();
    if (reaction.length === 0 || reaction.length > 16) {
      throw new BadRequestException('reaction is invalid.');
    }

    return reaction;
  }

  private normalizeActionType(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('actionType is required.');
    }

    return value.trim();
  }

  private normalizeActionPayload(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('payload must be an object.');
    }

    return value as Record<string, unknown>;
  }

  private normalizeCantoType(value: unknown): CantoOpenPayload['cantoType'] {
    if (
      value === 'envido' ||
      value === 'real_envido' ||
      value === 'falta_envido' ||
      value === 'truco' ||
      value === 'retruco' ||
      value === 'vale_cuatro'
    ) {
      return value;
    }

    throw new BadRequestException('Invalid cantoType.');
  }

  private normalizeCantoResponse(
    value: unknown,
  ): CantoResolvePayload['response'] {
    if (
      value === 'quiero' ||
      value === 'no_quiero' ||
      value === 'accepted' ||
      value === 'rejected'
    ) {
      return value;
    }

    throw new BadRequestException('Invalid canto response.');
  }

  private normalizeWildcardLabel(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private safeRoomCode(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return 'UNKNOWN';
    }

    return value.trim().toUpperCase();
  }

  private countTrickWins(trickResults: MatchView['trickResults']): {
    A: number;
    B: number;
  } {
    return trickResults.reduce(
      (acc, result) => {
        if (result.winnerTeamSide === 'A') {
          acc.A += 1;
        } else if (result.winnerTeamSide === 'B') {
          acc.B += 1;
        }

        return acc;
      },
      { A: 0, B: 0 },
    );
  }
}
