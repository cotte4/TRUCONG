import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ActionSubmitPayload,
  CardSuit,
  CreateRoomRequest,
  JoinRoomRequest,
  LobbyTeamPayload,
  MatchProgressState,
  MatchSummaryView,
  MatchView,
  PlayCardPayload,
  RoomEntryResponse,
  RoomSession,
  RoomSnapshot,
  RoomSeatSnapshot,
  SeatStatus,
  TeamScoreView,
  TeamSide,
  TrickResultView,
  WildcardSelectionState,
} from '@dimadong/contracts';
import {
  RoomStatus as DbRoomStatus,
  SeatStatus as DbSeatStatus,
} from '@prisma/client';
import {
  ActionLogPersistenceService,
  AnalyticsEventService,
  ConnectionSessionPersistenceService,
  type JsonInput,
  MatchPersistenceService,
  RoomPersistenceService,
} from '../persistence';

type PersistedSnapshotState = {
  room: RoomSnapshot;
  match: {
    handNumber: number;
    trickNumber: number;
    dealerSeatId: string | null;
    currentTurnSeatId: string | null;
    handsBySeatId: Record<string, MutableCard[]>;
    tableCards: MutableTablePlay[];
    teamScores: TeamScoreView;
    handTrickWins: TeamScoreView;
    currentHandPoints?: number;
    trickResults: MutableTrickResult[];
    pendingCanto?: MutablePendingCanto | null;
    pendingWildcardSelection?: MutablePendingWildcardSelection | null;
    recentEvents: string[];
    statusText: string;
    summary: MatchSummaryView | null;
    lastTrickResolvedAt?: string | null;
    lastHandScoredAt?: string | null;
    lastHandWinnerTeamSide?: TeamSide | null;
    turnDeadlineAt: string | null;
    reconnectDeadlineAt: string | null;
  } | null;
};

type MutableSeat = {
  id: string;
  persistedSeatId: string | null;
  persistedOccupancyId: string | null;
  persistedConnectionId: string | null;
  reconnectToken: string | null;
  seatIndex: number;
  teamSide: TeamSide | null;
  status: SeatStatus;
  displayName: string | null;
  isHost: boolean;
  isReady: boolean;
  roomSessionToken: string | null;
  seatClaimToken: string | null;
  socketId: string | null;
};

type MutableCard = {
  id: string;
  suit: CardSuit;
  rank: number;
  label: string;
  isWildcard: boolean;
};

type WildcardChoice = {
  rank: number;
  suit: CardSuit;
  label: string;
};

type MutableTablePlay = {
  seatId: string;
  card: MutableCard;
};

type MutableTrickResult = {
  trickNumber: number;
  winnerSeatId: string | null;
  winnerTeamSide: TeamSide | null;
  winningCardLabel: string | null;
};

type MutablePendingCanto = {
  cantoType:
    | 'truco'
    | 'retruco'
    | 'vale_cuatro'
    | 'envido'
    | 'real_envido'
    | 'falta_envido';
  actorSeatId: string;
  targetSeatId: string | null;
  openedAt: string;
  responseDeadlineAt: string | null;
};

type MutablePendingWildcardSelection = {
  seatId: string;
  cardId: string;
  selectedLabel: string | null;
  availableLabels: string[];
  requestedAt: string;
  selectionDeadlineAt: string | null;
};

type MutableMatchState = {
  persistedMatchId: string | null;
  snapshotVersion: number;
  handNumber: number;
  trickNumber: number;
  dealerSeatId: string | null;
  currentTurnSeatId: string | null;
  handsBySeatId: Record<string, MutableCard[]>;
  tableCards: MutableTablePlay[];
  teamScores: TeamScoreView;
  handTrickWins: TeamScoreView;
  currentHandPoints: number;
  trickResults: MutableTrickResult[];
  pendingCanto: MutablePendingCanto | null;
  pendingWildcardSelection: MutablePendingWildcardSelection | null;
  recentEvents: string[];
  statusText: string;
  summary: MatchSummaryView | null;
  lastTrickResolvedAt: string | null;
  lastHandScoredAt: string | null;
  lastHandWinnerTeamSide: TeamSide | null;
  turnDeadlineAt: string | null;
  reconnectDeadlineAt: string | null;
};

type MutableRoom = {
  id: string;
  persistedRoomId: string | null;
  snapshotVersion: number;
  code: string;
  phase: RoomSnapshot['phase'];
  hostSeatId: string | null;
  maxPlayers: number;
  targetScore: number;
  allowBongs: boolean;
  allow3v3: boolean;
  seats: MutableSeat[];
  match: MutableMatchState | null;
};

type MatchTransitionState = {
  phaseDetail: string | null;
  activeActionSeatId: string | null;
  latestTrickResult: TrickResultView | null;
  latestTrickResolvedAt: string | null;
  trickResult: {
    state: 'idle' | 'resolved';
    resolvedAt: string | null;
    winnerSeatId: string | null;
    winnerTeamSide: TeamSide | null;
    winningCardLabel: string | null;
  };
  handComplete: boolean;
  lastHandScoredAt: string | null;
  lastHandWinnerTeamSide: TeamSide | null;
  handSummary: {
    state: 'idle' | 'resolved';
    resolvedAt: string | null;
    finalScore: TeamScoreView | null;
    winnerTeamSide: TeamSide | null;
    reason: string | null;
  };
  matchComplete: boolean;
  winnerTeamSide: TeamSide | null;
  matchSummary: {
    state: 'idle' | 'resolved';
    resolvedAt: string | null;
    finalScore: TeamScoreView | null;
    winnerTeamSide: TeamSide | null;
    reason: string | null;
  };
};

type DetailedWildcardSelectionState = WildcardSelectionState & {
  phase: RoomSnapshot['phase'];
  isPending: boolean;
  ownerSeatId: string;
  selectedChoiceId: string | null;
  selectedChoiceLabel: string | null;
  availableChoices: Array<{
    id: string;
    label: string;
  }>;
  responseDeadlineAt: string | null;
  fixedForEnvido: boolean;
};

type RoomLifecycleState = {
  matchView: MatchView | null;
  progressState: MatchProgressState | null;
  transitionState: MatchTransitionState | null;
  wildcardSelectionState: DetailedWildcardSelectionState | null;
};

type PlayCardResult = {
  snapshot: RoomSnapshot;
  lifecycle: RoomLifecycleState;
  trickResolved: boolean;
  handScored: boolean;
  summaryStarted: boolean;
};

type ResolveCantoResult = {
  snapshot: RoomSnapshot;
  lifecycle: RoomLifecycleState;
  scoreDelta: TeamScoreView;
  matchEnded: boolean;
  handValueChanged: boolean;
};

type StartSummaryResult = {
  snapshot: RoomSnapshot;
  lifecycle: RoomLifecycleState;
  summaryStarted: boolean;
  source: 'manual' | 'match_end' | 'reconnect';
};

type OpenCantoResult = {
  snapshot: RoomSnapshot;
  lifecycle: RoomLifecycleState;
  responsePending: boolean;
};

type WildcardSelectionResult = {
  snapshot: RoomSnapshot;
  lifecycle: RoomLifecycleState;
  selectionPending: boolean;
  selectionResolved: boolean;
};

@Injectable()
export class RoomStoreService {
  private readonly logger = new Logger(RoomStoreService.name);
  private readonly roomsByCode = new Map<string, MutableRoom>();
  private readonly roomCodeByToken = new Map<string, string>();
  private readonly turnTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly reconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly cantoTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly wildcardTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    @Optional() private readonly roomPersistence?: RoomPersistenceService,
    @Optional() private readonly matchPersistence?: MatchPersistenceService,
    @Optional()
    private readonly connectionSessionPersistence?: ConnectionSessionPersistenceService,
    @Optional()
    private readonly actionLogPersistence?: ActionLogPersistenceService,
    @Optional() private readonly analyticsEventService?: AnalyticsEventService,
  ) {}

  createRoom(input: CreateRoomRequest): RoomEntryResponse {
    const displayName = input.displayName.trim();

    if (!displayName) {
      throw new Error('Display name is required.');
    }

    const maxPlayers = input.maxPlayers ?? 4;
    const targetScore = input.targetScore ?? 30;
    const allowBongs = input.allowBongs ?? true;
    const roomId = randomUUID();
    const code = this.generateRoomCode();
    const seats = this.createSeats(maxPlayers);
    const hostSeat = seats[0];
    const session = this.attachSeat(hostSeat, code, roomId, displayName);

    hostSeat.isHost = true;

    const room: MutableRoom = {
      id: roomId,
      persistedRoomId: null,
      snapshotVersion: 0,
      code,
      phase: 'lobby',
      hostSeatId: hostSeat.id,
      maxPlayers,
      targetScore,
      allowBongs,
      allow3v3: false,
      seats,
      match: null,
    };

    this.roomsByCode.set(code, room);
    this.persistRoomCreated(room, hostSeat, session);

    return {
      snapshot: this.buildSnapshot(room),
      session,
    };
  }

  joinRoom(code: string, input: JoinRoomRequest): RoomEntryResponse {
    const room = this.getRequiredRoom(code);
    const displayName = input.displayName.trim();

    if (!displayName) {
      throw new Error('Display name is required.');
    }

    const seat =
      (typeof input.preferredSeatIndex === 'number'
        ? room.seats.find(
            (entry) =>
              entry.seatIndex === input.preferredSeatIndex &&
              entry.status === 'open',
          )
        : undefined) ?? room.seats.find((entry) => entry.status === 'open');

    if (!seat) {
      throw new Error('Room is full.');
    }

    const session = this.attachSeat(seat, room.code, room.id, displayName);
    this.persistSeatClaim(room, seat, session, 'seat_joined');

    return {
      snapshot: this.buildSnapshot(room),
      session,
    };
  }

  getSnapshot(code: string): RoomSnapshot {
    return this.buildSnapshot(this.getRequiredRoom(code));
  }

  getSession(roomSessionToken: string): RoomSession | null {
    const roomCode = this.roomCodeByToken.get(roomSessionToken);

    if (!roomCode) {
      return null;
    }

    const room = this.roomsByCode.get(roomCode);

    if (!room) {
      return null;
    }

    const seat = room.seats.find(
      (entry) => entry.roomSessionToken === roomSessionToken,
    );

    if (
      !seat ||
      !seat.displayName ||
      !seat.roomSessionToken ||
      !seat.seatClaimToken
    ) {
      return null;
    }

    return {
      roomId: room.id,
      roomCode: room.code,
      seatId: seat.id,
      displayName: seat.displayName,
      roomSessionToken: seat.roomSessionToken,
      seatClaimToken: seat.seatClaimToken,
    };
  }

  async resumeRoom(code: string, roomSessionToken?: string | null) {
    await this.restoreRoomIfNeeded(code);
    const session = roomSessionToken ? this.getSession(roomSessionToken) : null;

    return {
      snapshot: this.getSnapshot(code),
      session,
      matchView: session ? this.getMatchView(code, session.seatId) : null,
    };
  }

  connectSession(code: string, roomSessionToken: string, socketId: string) {
    const room = this.getRequiredRoom(code);
    const seat = room.seats.find(
      (entry) => entry.roomSessionToken === roomSessionToken,
    );

    if (!seat) {
      throw new NotFoundException('Session not found.');
    }

    seat.socketId = socketId;
    seat.status = 'occupied';
    if (
      room.phase === 'reconnect_hold' &&
      room.match?.currentTurnSeatId === seat.id
    ) {
      room.phase = 'action_turn';
      room.match.reconnectDeadlineAt = null;
      this.clearReconnectTimeout(room.code);
      this.setStatus(
        room,
        `${seat.displayName ?? 'Player'} reconnected and can act.`,
      );
      this.scheduleTurnTimeout(room.code);
    }

    this.pushEvent(room, `${seat.displayName ?? 'Player'} reconnected.`);
    this.persistReconnect(room, seat);
    this.persistConnectionConnected(seat, socketId);

    return {
      snapshot: this.buildSnapshot(room),
      session: this.getSession(roomSessionToken),
    };
  }

  disconnectSocket(socketId: string) {
    for (const room of this.roomsByCode.values()) {
      const seat = room.seats.find((entry) => entry.socketId === socketId);

      if (!seat) {
        continue;
      }

      seat.socketId = null;

      if (seat.roomSessionToken) {
        seat.status = 'disconnected';
        seat.isReady = false;
        this.pushEvent(room, `${seat.displayName ?? 'Player'} disconnected.`);
        if (
          room.match &&
          room.phase === 'action_turn' &&
          room.match.currentTurnSeatId === seat.id
        ) {
          room.phase = 'reconnect_hold';
          room.match.reconnectDeadlineAt = new Date(
            Date.now() + 10_000,
          ).toISOString();
          room.match.turnDeadlineAt = null;
          this.clearTurnTimeout(room.code);
          this.setStatus(
            room,
            `Waiting for ${seat.displayName ?? 'player'} to reconnect.`,
          );
          this.scheduleReconnectTimeout(room.code);
        }

        this.persistAction(
          room,
          'seat_disconnected',
          {
            seatId: seat.id,
            displayName: seat.displayName,
          },
          seat,
        );
        this.persistConnectionDisconnected(socketId);
        this.persistSnapshot(room);
      }

      return this.buildSnapshot(room);
    }

    return null;
  }

  getMatchView(code: string, seatId: string): MatchView | null {
    const room = this.getRequiredRoom(code);

    if (!room.match) {
      return null;
    }

    const actorSeat = room.seats.find((seat) => seat.id === seatId);

    if (!actorSeat) {
      throw new NotFoundException('Seat not found.');
    }

    return {
      handNumber: room.match.handNumber,
      trickNumber: room.match.trickNumber,
      currentTurnSeatId: room.match.currentTurnSeatId,
      dealerSeatId: room.match.dealerSeatId,
      yourHand: room.match.handsBySeatId[seatId] ?? [],
      tableCards: room.match.tableCards.map((play) => ({
        seatId: play.seatId,
        displayName:
          room.seats.find((seat) => seat.id === play.seatId)?.displayName ??
          'Unknown',
        card: play.card,
      })),
      yourTeamSide: actorSeat.teamSide,
      score: room.match.teamScores,
      trickResults: room.match.trickResults,
      recentEvents: room.match.recentEvents,
      statusText: this.buildStatusText(room),
      summary: room.match.summary,
      turnDeadlineAt: room.match.turnDeadlineAt,
      reconnectDeadlineAt: room.match.reconnectDeadlineAt,
    };
  }

  getMatchProgressState(code: string): MatchProgressState | null {
    const room = this.getRequiredRoom(code);
    const match = room.match;

    if (!match) {
      return null;
    }

    return {
      phase: room.phase,
      handNumber: match.handNumber,
      trickNumber: match.trickNumber,
      dealerSeatId: match.dealerSeatId,
      currentTurnSeatId: match.currentTurnSeatId,
      handTrickWins: { ...match.handTrickWins },
      tableCards: match.tableCards.map((play) => ({
        seatId: play.seatId,
        displayName:
          room.seats.find((seat) => seat.id === play.seatId)?.displayName ??
          'Player',
        card: {
          id: play.card.id,
          rank: play.card.rank,
          suit: play.card.suit,
          label: play.card.label,
          isWildcard: play.card.isWildcard,
        },
      })),
      resolvedTricks: match.trickResults.map((result) => ({
        trickNumber: result.trickNumber,
        winnerSeatId: result.winnerSeatId,
        winnerTeamSide: result.winnerTeamSide,
        winningCardLabel: result.winningCardLabel,
      })),
      score: { ...match.teamScores },
      statusText: this.buildStatusText(room),
      turnDeadlineAt: match.turnDeadlineAt,
      reconnectDeadlineAt: match.reconnectDeadlineAt,
      summary: match.summary,
    };
  }

  getPendingWildcardSelectionState(
    code: string,
  ): DetailedWildcardSelectionState | null {
    const room = this.getRequiredRoom(code);
    const pending = room.match?.pendingWildcardSelection;

    if (!pending) {
      return null;
    }

    return {
      seatId: pending.seatId,
      cardId: pending.cardId,
      selectedLabel: pending.selectedLabel,
      availableLabels: [...pending.availableLabels],
      requestedAt: pending.requestedAt,
      selectionDeadlineAt: pending.selectionDeadlineAt,
      phase: room.phase,
      isPending: room.phase === 'wildcard_selection',
      ownerSeatId: pending.seatId,
      selectedChoiceId: pending.selectedLabel
        ? this.toChoiceId(pending.selectedLabel)
        : null,
      selectedChoiceLabel: pending.selectedLabel,
      availableChoices: pending.availableLabels.map((label) => ({
        id: this.toChoiceId(label),
        label,
      })),
      responseDeadlineAt: pending.selectionDeadlineAt,
      fixedForEnvido: false,
    };
  }

  getMatchTransitionState(code: string): MatchTransitionState | null {
    const room = this.getRequiredRoom(code);
    const match = room.match;

    if (!match) {
      return null;
    }

    const latestTrickResult =
      match.trickResults[match.trickResults.length - 1] ?? null;
    const handComplete =
      room.phase === 'hand_scoring' ||
      room.phase === 'match_end' ||
      room.phase === 'post_match_summary';
    const matchComplete =
      room.phase === 'match_end' || room.phase === 'post_match_summary';
    const handSummaryScore = handComplete ? { ...match.teamScores } : null;
    const matchSummaryScore = match.summary
      ? { ...match.summary.finalScore }
      : handSummaryScore;

    return {
      phaseDetail: this.getPhaseDetail(room),
      activeActionSeatId: this.getActiveActionSeatId(room),
      latestTrickResult,
      latestTrickResolvedAt: match.lastTrickResolvedAt,
      trickResult: {
        state: latestTrickResult ? 'resolved' : 'idle',
        resolvedAt: match.lastTrickResolvedAt,
        winnerSeatId: latestTrickResult?.winnerSeatId ?? null,
        winnerTeamSide: latestTrickResult?.winnerTeamSide ?? null,
        winningCardLabel: latestTrickResult?.winningCardLabel ?? null,
      },
      handComplete,
      lastHandScoredAt: match.lastHandScoredAt,
      lastHandWinnerTeamSide: match.lastHandWinnerTeamSide,
      handSummary: {
        state: handComplete ? 'resolved' : 'idle',
        resolvedAt: match.lastHandScoredAt,
        finalScore: handSummaryScore,
        winnerTeamSide: match.lastHandWinnerTeamSide,
        reason: match.lastHandWinnerTeamSide
          ? `Team ${match.lastHandWinnerTeamSide} won hand ${match.handNumber}.`
          : null,
      },
      matchComplete,
      winnerTeamSide: match.summary?.winnerTeamSide ?? null,
      matchSummary: {
        state: matchComplete ? 'resolved' : 'idle',
        resolvedAt: match.lastHandScoredAt,
        finalScore: matchSummaryScore,
        winnerTeamSide:
          match.summary?.winnerTeamSide ?? match.lastHandWinnerTeamSide ?? null,
        reason: match.summary?.winnerTeamSide
          ? `Team ${match.summary.winnerTeamSide} won the match.`
          : matchComplete && match.lastHandWinnerTeamSide
            ? `Team ${match.lastHandWinnerTeamSide} closed the match sequence.`
            : null,
      },
    };
  }

  getRoomLifecycleState(
    code: string,
    seatId?: string | null,
  ): RoomLifecycleState {
    return {
      matchView: seatId ? this.getMatchView(code, seatId) : null,
      progressState: this.getMatchProgressState(code),
      transitionState: this.getMatchTransitionState(code),
      wildcardSelectionState: this.getPendingWildcardSelectionState(code),
    };
  }

  submitAction(payload: ActionSubmitPayload) {
    const roomCode = payload.roomCode.toUpperCase();

    switch (payload.actionType) {
      case 'play_card': {
        const cardId = this.requireStringField(payload.payload, 'cardId');

        return this.playCard({
          roomCode,
          roomSessionToken: payload.roomSessionToken,
          cardId,
        });
      }
      case 'canto_open': {
        const cantoType = this.requireCantoType(payload.payload.cantoType);
        const targetSeatId = this.readOptionalStringField(
          payload.payload,
          'targetSeatId',
        );

        return this.openCanto(
          roomCode,
          payload.roomSessionToken,
          cantoType,
          targetSeatId,
        );
      }
      case 'canto_resolve': {
        const response = this.requireCantoResponse(payload.payload.response);

        return this.resolveCanto(roomCode, payload.roomSessionToken, response);
      }
      case 'wildcard_request': {
        const cardId = this.requireStringField(payload.payload, 'cardId');

        return this.requestWildcardSelection(
          roomCode,
          payload.roomSessionToken,
          cardId,
        );
      }
      case 'wildcard_select': {
        const cardId = this.requireStringField(payload.payload, 'cardId');
        const selectedLabel = this.requireStringField(
          payload.payload,
          'selectedLabel',
        );

        return this.selectWildcard(
          roomCode,
          payload.roomSessionToken,
          cardId,
          selectedLabel,
        );
      }
      case 'summary_start': {
        const source = this.requireSummarySource(payload.payload.source);

        return this.startSummary(roomCode, payload.roomSessionToken, source);
      }
      default:
        throw new Error(`Unsupported action type: ${payload.actionType}`);
    }
  }

  toggleReady(code: string, roomSessionToken: string) {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (room.phase !== 'lobby') {
      throw new Error(
        'Ready state can only be changed while the room is in the lobby.',
      );
    }

    actorSeat.isReady = !actorSeat.isReady;
    actorSeat.status = 'occupied';
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Player'} is now ${actorSeat.isReady ? 'ready' : 'not ready'}.`,
    );
    this.persistAction(
      room,
      actorSeat.isReady ? 'ready_on' : 'ready_off',
      { seatId: actorSeat.id, isReady: actorSeat.isReady },
      actorSeat,
    );
    this.persistSnapshot(room);

    return this.buildSnapshot(room);
  }

  assignTeam(payload: LobbyTeamPayload) {
    const { room, actorSeat } = this.getAuthorizedSeat(
      payload.roomCode,
      payload.roomSessionToken,
    );

    if (!actorSeat.isHost) {
      throw new Error('Only the host can change team assignments.');
    }

    if (room.phase !== 'lobby') {
      throw new Error(
        'Teams can only be edited while the room is in the lobby.',
      );
    }

    const targetSeat = room.seats.find(
      (entry) => entry.id === payload.targetSeatId,
    );

    if (!targetSeat) {
      throw new Error('Seat not found.');
    }

    targetSeat.teamSide = payload.teamSide;
    this.clearReadyState(room);
    this.pushEvent(
      room,
      `${targetSeat.displayName ?? 'Seat'} moved to Team ${payload.teamSide}.`,
    );
    this.persistAction(
      room,
      'team_assigned',
      { targetSeatId: targetSeat.id, teamSide: payload.teamSide },
      actorSeat,
    );
    this.persistSnapshot(room);

    return this.buildSnapshot(room);
  }

  startMatch(code: string, roomSessionToken: string) {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (!actorSeat.isHost) {
      throw new Error('Only the host can start the match.');
    }

    if (room.phase !== 'lobby') {
      throw new Error('Match has already started.');
    }

    const occupiedSeats = this.getOccupiedSeats(room);

    if (occupiedSeats.length !== room.maxPlayers) {
      throw new Error('All seats must be filled before the match can start.');
    }

    if (!occupiedSeats.every((seat) => seat.isReady)) {
      throw new Error(
        'Every player must mark ready before the match can start.',
      );
    }

    if (!this.hasValidTeams(room)) {
      throw new Error('Teams must be balanced before starting the match.');
    }

    room.match = this.createInitialMatch(room);
    room.phase = 'action_turn';
    this.pushEvent(room, 'Match started. Cards dealt.');
    this.setStatus(room, 'Hand 1 is live.');
    this.scheduleTurnTimeout(room.code);
    this.persistMatchStarted(room, actorSeat);

    return this.buildSnapshot(room);
  }

  startSummary(
    code: string,
    roomSessionToken: string,
    source: 'manual' | 'match_end' | 'reconnect' = 'manual',
  ) {
    return this.startSummaryWithResult(code, roomSessionToken, source).snapshot;
  }

  startSummaryWithResult(
    code: string,
    roomSessionToken: string,
    source: 'manual' | 'match_end' | 'reconnect' = 'manual',
  ): StartSummaryResult {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (!room.match?.summary) {
      throw new Error('Summary is only available after the match ends.');
    }

    room.phase = 'post_match_summary';
    room.match.turnDeadlineAt = null;
    room.match.reconnectDeadlineAt = null;
    this.clearTurnTimeout(room.code);
    this.clearReconnectTimeout(room.code);
    this.clearCantoTimeout(room.code);
    this.clearWildcardTimeout(room.code);
    this.setStatus(
      room,
      `Final summary opened by ${actorSeat.displayName ?? 'player'}.`,
    );
    this.pushEvent(room, `Summary started (${source}).`);
    this.persistAction(
      room,
      'summary_started',
      {
        source,
        seatId: actorSeat.id,
      },
      actorSeat,
    );
    this.persistSnapshot(room);

    const snapshot = this.buildSnapshot(room);
    const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);

    return {
      snapshot,
      lifecycle,
      summaryStarted: room.phase === 'post_match_summary',
      source,
    };
  }

  openCanto(
    code: string,
    roomSessionToken: string,
    cantoType: MutablePendingCanto['cantoType'],
    targetSeatId?: string | null,
  ) {
    return this.openCantoWithResult(
      code,
      roomSessionToken,
      cantoType,
      targetSeatId,
    ).snapshot;
  }

  openCantoWithResult(
    code: string,
    roomSessionToken: string,
    cantoType: MutablePendingCanto['cantoType'],
    targetSeatId?: string | null,
  ): OpenCantoResult {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (room.phase !== 'action_turn' || !room.match) {
      throw new Error('Cantos can only be opened during an active turn.');
    }

    if (room.match.currentTurnSeatId !== actorSeat.id) {
      throw new Error('Only the active player can open a canto.');
    }

    if (room.match.pendingCanto) {
      throw new Error('There is already a pending canto response.');
    }

    this.validateCantoOpen(room, cantoType);

    room.phase = 'response_pending';
    room.match.pendingCanto = {
      cantoType,
      actorSeatId: actorSeat.id,
      targetSeatId: targetSeatId ?? null,
      openedAt: new Date().toISOString(),
      responseDeadlineAt: new Date(Date.now() + 12_000).toISOString(),
    };
    room.match.turnDeadlineAt = null;
    this.clearTurnTimeout(room.code);
    this.scheduleCantoTimeout(room.code);
    this.setStatus(
      room,
      `${actorSeat.displayName ?? 'Player'} called ${cantoType}.`,
    );
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Player'} called ${cantoType}.`,
    );
    this.persistAction(
      room,
      'canto_opened',
      {
        cantoType,
        actorSeatId: actorSeat.id,
        targetSeatId: targetSeatId ?? null,
      },
      actorSeat,
    );
    this.persistSnapshot(room);

    const snapshot = this.buildSnapshot(room);
    const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);

    return {
      snapshot,
      lifecycle,
      responsePending: room.phase === 'response_pending',
    };
  }

  resolveCanto(
    code: string,
    roomSessionToken: string,
    response: 'quiero' | 'no_quiero' | 'accepted' | 'rejected',
  ) {
    return this.resolveCantoWithResult(code, roomSessionToken, response)
      .snapshot;
  }

  resolveCantoWithResult(
    code: string,
    roomSessionToken: string,
    response: 'quiero' | 'no_quiero' | 'accepted' | 'rejected',
  ): ResolveCantoResult {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);
    const beforeTransition = this.getMatchTransitionState(room.code);
    const beforeHandPoints = room.match?.currentHandPoints ?? 1;

    if (room.phase !== 'response_pending' || !room.match?.pendingCanto) {
      throw new Error('There is no pending canto to resolve.');
    }

    const pending = room.match.pendingCanto;
    const actorTeamSide = actorSeat.teamSide;
    const callerTeamSide =
      room.seats.find((seat) => seat.id === pending.actorSeatId)?.teamSide ??
      null;

    if (pending.targetSeatId && pending.targetSeatId !== actorSeat.id) {
      throw new Error('This canto must be resolved by the targeted seat.');
    }

    room.match.pendingCanto = null;
    room.match.reconnectDeadlineAt = null;
    this.clearCantoTimeout(room.code);

    const normalizedResponse =
      response === 'quiero' || response === 'accepted' ? 'quiero' : 'no_quiero';
    let scoreDelta =
      normalizedResponse === 'no_quiero' && callerTeamSide
        ? {
            A:
              callerTeamSide === 'A'
                ? this.getDeclinedCantoPoints(pending.cantoType)
                : 0,
            B:
              callerTeamSide === 'B'
                ? this.getDeclinedCantoPoints(pending.cantoType)
                : 0,
          }
        : { A: 0, B: 0 };

    if (scoreDelta.A > 0 || scoreDelta.B > 0) {
      room.match.teamScores = {
        A: room.match.teamScores.A + scoreDelta.A,
        B: room.match.teamScores.B + scoreDelta.B,
      };
      this.pushEvent(
        room,
        `${actorSeat.displayName ?? 'Player'} declined ${pending.cantoType}.`,
      );
    } else {
      if (this.isTrucoCanto(pending.cantoType)) {
        room.match.currentHandPoints = Math.max(
          room.match.currentHandPoints,
          this.getAcceptedTrucoPoints(pending.cantoType),
        );
      } else {
        scoreDelta = this.getAcceptedEnvidoScoreDelta(room, pending.cantoType);
        room.match.teamScores = {
          A: room.match.teamScores.A + scoreDelta.A,
          B: room.match.teamScores.B + scoreDelta.B,
        };
      }
      this.pushEvent(
        room,
        this.isTrucoCanto(pending.cantoType)
          ? `${actorSeat.displayName ?? 'Player'} accepted ${pending.cantoType}.`
          : `${actorSeat.displayName ?? 'Player'} accepted ${pending.cantoType}; ${this.describeAwardedTeam(scoreDelta)}.`,
      );
    }

    const winningTeam = this.getWinningTeamForScore(
      room.match.teamScores,
      room.targetScore,
    );

    if (winningTeam) {
      room.phase = 'match_end';
      room.match.currentTurnSeatId = null;
      room.match.turnDeadlineAt = null;
      room.match.reconnectDeadlineAt = null;
      room.match.lastHandScoredAt = new Date().toISOString();
      room.match.lastHandWinnerTeamSide = winningTeam;
      room.match.summary = {
        winnerTeamSide: winningTeam,
        finalScore: { ...room.match.teamScores },
      };
      this.clearTurnTimeout(room.code);
      this.clearReconnectTimeout(room.code);
      this.setStatus(room, `Team ${winningTeam} wins the match.`);
      this.pushEvent(
        room,
        `Match finished. Team ${winningTeam} reached ${room.targetScore}.`,
      );
      this.persistMatchFinished(room, winningTeam);
    } else {
      room.phase = 'action_turn';
      room.match.turnDeadlineAt = null;
      this.setStatus(
        room,
        normalizedResponse === 'no_quiero'
          ? `Hand resumes after ${pending.cantoType}.`
          : `${actorSeat.displayName ?? 'Player'} accepted ${pending.cantoType}.`,
      );
      this.scheduleTurnTimeout(room.code);
    }

    this.persistAction(
      room,
      'canto_resolved',
      {
        cantoType: pending.cantoType,
        response,
        actorSeatId: actorSeat.id,
        actorTeamSide,
      },
      actorSeat,
    );
    this.persistSnapshot(room);

    const snapshot = this.buildSnapshot(room);
    const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);
    const afterTransition = lifecycle.transitionState;

    return {
      snapshot,
      lifecycle,
      scoreDelta,
      matchEnded: Boolean(
        afterTransition?.matchComplete && !beforeTransition?.matchComplete,
      ),
      handValueChanged:
        (room.match?.currentHandPoints ?? beforeHandPoints) !==
        beforeHandPoints,
    };
  }

  requestWildcardSelection(
    code: string,
    roomSessionToken: string,
    cardId: string,
  ) {
    return this.requestWildcardSelectionWithResult(
      code,
      roomSessionToken,
      cardId,
    ).snapshot;
  }

  requestWildcardSelectionWithResult(
    code: string,
    roomSessionToken: string,
    cardId: string,
  ): WildcardSelectionResult {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (room.phase !== 'action_turn' || !room.match) {
      throw new Error(
        'Wildcard selection is only available during an active hand.',
      );
    }

    if (room.match.currentTurnSeatId !== actorSeat.id) {
      throw new Error('Only the active player can select a wildcard.');
    }

    const card = (room.match.handsBySeatId[actorSeat.id] ?? []).find(
      (entry) => entry.id === cardId,
    );

    if (!card?.isWildcard) {
      throw new Error('Selected card is not a wildcard.');
    }

    const availableLabels = this.getLegalWildcardChoices(room, cardId).map(
      (choice) => choice.label,
    );

    room.phase = 'wildcard_selection';
    room.match.pendingWildcardSelection = {
      seatId: actorSeat.id,
      cardId,
      selectedLabel: null,
      availableLabels,
      requestedAt: new Date().toISOString(),
      selectionDeadlineAt: new Date(Date.now() + 15_000).toISOString(),
    };
    room.match.turnDeadlineAt = null;
    this.clearTurnTimeout(room.code);
    this.scheduleWildcardTimeout(room.code);
    this.setStatus(
      room,
      `${actorSeat.displayName ?? 'Player'} is selecting a wildcard value.`,
    );
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Player'} opened wildcard selection.`,
    );
    this.persistAction(
      room,
      'wildcard_selection_requested',
      {
        seatId: actorSeat.id,
        cardId,
        availableLabels,
      },
      actorSeat,
    );
    this.persistSnapshot(room);

    const snapshot = this.buildSnapshot(room);
    const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);

    return {
      snapshot,
      lifecycle,
      selectionPending: room.phase === 'wildcard_selection',
      selectionResolved: false,
    };
  }

  selectWildcard(
    code: string,
    roomSessionToken: string,
    cardId: string,
    selectedLabel: string,
  ) {
    return this.selectWildcardWithResult(
      code,
      roomSessionToken,
      cardId,
      selectedLabel,
    ).snapshot;
  }

  selectWildcardWithResult(
    code: string,
    roomSessionToken: string,
    cardId: string,
    selectedLabel: string,
  ): WildcardSelectionResult {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (
      room.phase !== 'wildcard_selection' ||
      !room.match?.pendingWildcardSelection
    ) {
      throw new Error('There is no pending wildcard selection.');
    }

    const pending = room.match.pendingWildcardSelection;

    if (pending.seatId !== actorSeat.id || pending.cardId !== cardId) {
      throw new Error(
        'This wildcard selection does not belong to the current player.',
      );
    }

    const card = (room.match.handsBySeatId[actorSeat.id] ?? []).find(
      (entry) => entry.id === cardId,
    );

    if (!card) {
      throw new Error('Wildcard card not found in hand.');
    }

    const selectedChoice = this.requireLegalWildcardSelectionByLabel(
      selectedLabel,
      this.getLegalWildcardChoices(room, cardId),
    );

    card.label = selectedChoice.label;
    card.rank = selectedChoice.rank;
    card.suit = selectedChoice.suit;
    card.isWildcard = false;
    room.match.pendingWildcardSelection = null;
    this.clearWildcardTimeout(room.code);
    room.phase = 'action_turn';
    room.match.turnDeadlineAt = null;
    this.setStatus(
      room,
      `${actorSeat.displayName ?? 'Player'} selected ${selectedLabel}.`,
    );
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Player'} set wildcard to ${selectedLabel}.`,
    );
    this.scheduleTurnTimeout(room.code);
    this.persistAction(
      room,
      'wildcard_selected',
      {
        seatId: actorSeat.id,
        cardId,
        selectedLabel,
      },
      actorSeat,
    );
    this.persistSnapshot(room);

    const snapshot = this.buildSnapshot(room);
    const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);

    return {
      snapshot,
      lifecycle,
      selectionPending: false,
      selectionResolved: true,
    };
  }

  destroyRoom(code: string, roomSessionToken: string, reason?: string) {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (!actorSeat.isHost) {
      throw new Error('Only the host can destroy the room.');
    }

    this.clearTurnTimeout(room.code);
    this.clearReconnectTimeout(room.code);
    this.clearCantoTimeout(room.code);
    this.clearWildcardTimeout(room.code);
    this.persistAction(
      room,
      'room_destroyed',
      {
        seatId: actorSeat.id,
        reason: reason ?? 'Host ended the room.',
      },
      actorSeat,
    );

    const snapshot = this.buildSnapshot(room);

    for (const seat of room.seats) {
      if (seat.roomSessionToken) {
        this.roomCodeByToken.delete(seat.roomSessionToken);
      }
    }

    this.roomsByCode.delete(room.code);

    return snapshot;
  }

  playCard(payload: PlayCardPayload) {
    return this.playCardWithResult(payload).snapshot;
  }

  playCardWithResult(payload: PlayCardPayload): PlayCardResult {
    const { room, actorSeat } = this.getAuthorizedSeat(
      payload.roomCode,
      payload.roomSessionToken,
    );
    const beforeTransition = this.getMatchTransitionState(room.code);

    if (room.phase !== 'action_turn' || !room.match) {
      throw new Error('Cards can only be played during an active turn.');
    }

    if (room.match.currentTurnSeatId !== actorSeat.id) {
      throw new Error('It is not your turn.');
    }

    if (room.match.pendingCanto) {
      throw new Error(
        'Card play is blocked while a canto response is pending.',
      );
    }

    const hand = room.match.handsBySeatId[actorSeat.id] ?? [];
    const cardIndex = hand.findIndex((card) => card.id === payload.cardId);

    if (cardIndex === -1) {
      throw new Error('Card not found in hand.');
    }

    const [card] = hand.splice(cardIndex, 1);
    room.match.tableCards.push({ seatId: actorSeat.id, card });
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Player'} played ${card.label}.`,
    );
    room.match.reconnectDeadlineAt = null;
    this.clearReconnectTimeout(room.code);
    this.persistAction(
      room,
      'card_played',
      {
        seatId: actorSeat.id,
        cardId: card.id,
        cardLabel: card.label,
        trickNumber: room.match.trickNumber,
        handNumber: room.match.handNumber,
      },
      actorSeat,
    );

    const occupiedSeats = this.getOccupiedSeats(room);
    const currentSeatIndex = occupiedSeats.findIndex(
      (seat) => seat.id === actorSeat.id,
    );
    const nextSeat =
      occupiedSeats[(currentSeatIndex + 1) % occupiedSeats.length] ?? null;

    if (room.match.tableCards.length >= occupiedSeats.length) {
      this.resolveCurrentTrick(room);
    } else {
      room.match.currentTurnSeatId = nextSeat?.id ?? null;
      this.setStatus(
        room,
        `${room.seats.find((seat) => seat.id === room.match?.currentTurnSeatId)?.displayName ?? 'Next player'} to act.`,
      );
      this.scheduleTurnTimeout(room.code);
    }

    this.persistSnapshot(room);

    const snapshot = this.buildSnapshot(room);
    const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);
    const afterTransition = lifecycle.transitionState;

    return {
      snapshot,
      lifecycle,
      trickResolved:
        Boolean(afterTransition?.latestTrickResolvedAt) &&
        afterTransition?.latestTrickResolvedAt !==
          beforeTransition?.latestTrickResolvedAt,
      handScored:
        Boolean(afterTransition?.lastHandScoredAt) &&
        afterTransition?.lastHandScoredAt !==
          beforeTransition?.lastHandScoredAt,
      summaryStarted: Boolean(
        afterTransition?.matchComplete && !beforeTransition?.matchComplete,
      ),
    };
  }

  private getRequiredRoom(code: string) {
    const room = this.roomsByCode.get(code.toUpperCase());

    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    return room;
  }

  private async restoreRoomIfNeeded(code: string) {
    const normalizedCode = code.toUpperCase();

    if (this.roomsByCode.has(normalizedCode) || !this.roomPersistence) {
      return;
    }

    const persistedRoom =
      await this.roomPersistence.findRoomByCode(normalizedCode);

    if (!persistedRoom?.snapshots[0]?.state) {
      return;
    }

    const state = persistedRoom.snapshots[0]
      .state as unknown as PersistedSnapshotState;
    const restoredRoom = this.hydrateRoomFromPersistence(
      persistedRoom,
      state,
      persistedRoom.snapshots[0].version,
    );
    this.roomsByCode.set(normalizedCode, restoredRoom);
  }

  private buildSnapshot(room: MutableRoom): RoomSnapshot {
    return {
      roomId: room.id,
      code: room.code,
      phase: room.phase,
      hostSeatId: room.hostSeatId,
      maxPlayers: room.maxPlayers,
      targetScore: room.targetScore,
      allowBongs: room.allowBongs,
      allow3v3: room.allow3v3,
      seats: room.seats.map<RoomSeatSnapshot>((seat) => ({
        id: seat.id,
        seatIndex: seat.seatIndex,
        status: seat.status,
        teamSide: seat.teamSide,
        displayName: seat.displayName,
        isHost: seat.isHost,
        isReady: seat.isReady,
        handCount: room.match?.handsBySeatId[seat.id]?.length ?? 0,
      })),
      score: room.match?.teamScores ?? { A: 0, B: 0 },
      recentEvents: room.match?.recentEvents ?? [],
      statusText: room.match?.statusText ?? 'Waiting in lobby.',
      winnerTeamSide: room.match?.summary?.winnerTeamSide ?? null,
      turnDeadlineAt: room.match?.turnDeadlineAt ?? null,
      reconnectDeadlineAt: room.match?.reconnectDeadlineAt ?? null,
    };
  }

  private createSeats(maxPlayers: number): MutableSeat[] {
    return Array.from(
      { length: maxPlayers },
      (_, seatIndex): MutableSeat => ({
        id: randomUUID(),
        persistedSeatId: null,
        persistedOccupancyId: null,
        persistedConnectionId: null,
        reconnectToken: null,
        seatIndex,
        teamSide: seatIndex % 2 === 0 ? 'A' : 'B',
        status: 'open',
        displayName: null,
        isHost: false,
        isReady: false,
        roomSessionToken: null,
        seatClaimToken: null,
        socketId: null,
      }),
    );
  }

  private hydrateRoomFromPersistence(
    persistedRoom: Awaited<
      ReturnType<RoomPersistenceService['findRoomByCode']>
    >,
    state: PersistedSnapshotState,
    snapshotVersion: number,
  ): MutableRoom {
    const roomState = state.room;
    const persistedSeatsByIndex = new Map(
      persistedRoom!.seats.map((seat) => [seat.seatIndex, seat]),
    );
    const seats = roomState.seats.map<MutableSeat>((seatSnapshot) => {
      const persistedSeat = persistedSeatsByIndex.get(seatSnapshot.seatIndex);
      const occupancy = persistedSeat?.occupancies[0];
      const latestConnection = occupancy?.connections[0];

      if (occupancy?.roomSessionToken) {
        this.roomCodeByToken.set(occupancy.roomSessionToken, roomState.code);
      }

      return {
        id: seatSnapshot.id,
        persistedSeatId: persistedSeat?.id ?? null,
        persistedOccupancyId: occupancy?.id ?? null,
        persistedConnectionId: latestConnection?.id ?? null,
        reconnectToken: latestConnection?.reconnectToken ?? null,
        seatIndex: seatSnapshot.seatIndex,
        teamSide: seatSnapshot.teamSide,
        status: seatSnapshot.status,
        displayName: seatSnapshot.displayName,
        isHost: seatSnapshot.isHost,
        isReady: seatSnapshot.isReady,
        roomSessionToken: occupancy?.roomSessionToken ?? null,
        seatClaimToken: occupancy?.seatClaimToken ?? null,
        socketId: null,
      };
    });

    const match = state.match
      ? {
          persistedMatchId: persistedRoom?.currentMatchId ?? null,
          snapshotVersion,
          handNumber: state.match.handNumber,
          trickNumber: state.match.trickNumber,
          dealerSeatId: state.match.dealerSeatId,
          currentTurnSeatId: state.match.currentTurnSeatId,
          handsBySeatId: state.match.handsBySeatId,
          tableCards: state.match.tableCards,
          teamScores: state.match.teamScores,
          handTrickWins: state.match.handTrickWins,
          currentHandPoints: state.match.currentHandPoints ?? 1,
          trickResults: state.match.trickResults,
          pendingCanto: state.match.pendingCanto ?? null,
          pendingWildcardSelection:
            state.match.pendingWildcardSelection ?? null,
          recentEvents: state.match.recentEvents,
          statusText: state.match.statusText,
          summary: state.match.summary,
          lastTrickResolvedAt: state.match.lastTrickResolvedAt ?? null,
          lastHandScoredAt: state.match.lastHandScoredAt ?? null,
          lastHandWinnerTeamSide: state.match.lastHandWinnerTeamSide ?? null,
          turnDeadlineAt: state.match.turnDeadlineAt,
          reconnectDeadlineAt: state.match.reconnectDeadlineAt,
        }
      : null;

    return {
      id: roomState.roomId,
      persistedRoomId: persistedRoom?.id ?? null,
      snapshotVersion,
      code: roomState.code,
      phase: roomState.phase,
      hostSeatId: roomState.hostSeatId,
      maxPlayers: roomState.maxPlayers,
      targetScore: roomState.targetScore,
      allowBongs: roomState.allowBongs,
      allow3v3: roomState.allow3v3,
      seats,
      match,
    };
  }

  private createInitialMatch(room: MutableRoom): MutableMatchState {
    const occupiedSeats = this.getOccupiedSeats(room);
    const deck = this.shuffle(this.createDeck());
    const handsBySeatId: Record<string, MutableCard[]> = {};

    for (const seat of occupiedSeats) {
      handsBySeatId[seat.id] = deck.splice(0, 3);
      seat.isReady = false;
    }

    return {
      persistedMatchId: null,
      snapshotVersion: 0,
      handNumber: 1,
      trickNumber: 1,
      dealerSeatId: occupiedSeats[0]?.id ?? null,
      currentTurnSeatId: occupiedSeats[0]?.id ?? null,
      handsBySeatId,
      tableCards: [],
      teamScores: { A: 0, B: 0 },
      handTrickWins: { A: 0, B: 0 },
      currentHandPoints: 1,
      trickResults: [],
      pendingCanto: null,
      pendingWildcardSelection: null,
      recentEvents: [],
      statusText: `${occupiedSeats[0]?.displayName ?? 'First player'} to act.`,
      summary: null,
      lastTrickResolvedAt: null,
      lastHandScoredAt: null,
      lastHandWinnerTeamSide: null,
      turnDeadlineAt: null,
      reconnectDeadlineAt: null,
    };
  }

  private resolveCurrentTrick(room: MutableRoom) {
    const match = room.match;

    if (!match) {
      return;
    }

    const winningPlay = this.getWinningPlay(match.tableCards);
    const winningSeat = winningPlay
      ? (room.seats.find((seat) => seat.id === winningPlay.seatId) ?? null)
      : null;
    const winningTeamSide = winningSeat?.teamSide ?? null;
    const trickNumber = match.trickNumber;

    if (winningTeamSide) {
      match.handTrickWins[winningTeamSide] += 1;
    }

    match.trickResults = [
      ...match.trickResults,
      {
        trickNumber,
        winnerSeatId: winningSeat?.id ?? null,
        winnerTeamSide: winningTeamSide,
        winningCardLabel: winningPlay?.card.label ?? null,
      },
    ].slice(-6);
    match.lastTrickResolvedAt = new Date().toISOString();

    this.pushEvent(
      room,
      winningSeat
        ? `${winningSeat.displayName ?? 'Player'} won trick ${trickNumber} with ${winningPlay?.card.label ?? 'a card'}.`
        : `Trick ${trickNumber} ended in a tie.`,
    );

    const handWinner = this.getHandWinner(room, match, trickNumber);

    if (handWinner) {
      match.teamScores[handWinner] += match.currentHandPoints;
      match.lastHandWinnerTeamSide = handWinner;
      match.lastHandScoredAt = new Date().toISOString();
      this.pushEvent(
        room,
        `Team ${handWinner} won hand ${match.handNumber} for ${match.currentHandPoints} point${match.currentHandPoints === 1 ? '' : 's'}.`,
      );

      if (match.teamScores[handWinner] >= room.targetScore) {
        room.phase = 'match_end';
        match.currentTurnSeatId = null;
        match.tableCards = [];
        match.summary = {
          winnerTeamSide: handWinner,
          finalScore: { ...match.teamScores },
        };
        match.turnDeadlineAt = null;
        match.reconnectDeadlineAt = null;
        this.clearTurnTimeout(room.code);
        this.clearReconnectTimeout(room.code);
        this.setStatus(room, `Team ${handWinner} wins the match.`);
        this.pushEvent(
          room,
          `Match finished. Team ${handWinner} reached ${room.targetScore}.`,
        );
        this.persistMatchFinished(room, handWinner);
        this.persistSnapshot(room);
        return;
      }

      this.prepareNextHand(
        room,
        winningSeat?.id ?? this.getOccupiedSeats(room)[0]?.id ?? null,
      );
      return;
    }

    match.tableCards = [];
    match.trickNumber += 1;
    match.currentTurnSeatId = winningSeat?.id ?? match.currentTurnSeatId;
    this.setStatus(
      room,
      `${winningSeat?.displayName ?? 'Next player'} leads trick ${match.trickNumber}.`,
    );
    this.scheduleTurnTimeout(room.code);
    this.persistAction(room, 'trick_resolved', {
      trickNumber,
      winnerSeatId: winningSeat?.id ?? null,
      winnerTeamSide: winningTeamSide,
      winningCardLabel: winningPlay?.card.label ?? null,
    });
  }

  private prepareNextHand(room: MutableRoom, nextDealerSeatId: string | null) {
    const match = room.match;

    if (!match) {
      return;
    }

    const occupiedSeats = this.getOccupiedSeats(room);
    const deck = this.shuffle(this.createDeck());
    const handsBySeatId: Record<string, MutableCard[]> = {};

    for (const seat of occupiedSeats) {
      handsBySeatId[seat.id] = deck.splice(0, 3);
    }

    match.handNumber += 1;
    match.trickNumber = 1;
    match.dealerSeatId = nextDealerSeatId;
    match.currentTurnSeatId = nextDealerSeatId;
    match.handsBySeatId = handsBySeatId;
    match.tableCards = [];
    match.handTrickWins = { A: 0, B: 0 };
    match.currentHandPoints = 1;
    match.lastHandScoredAt = null;
    match.lastHandWinnerTeamSide = null;
    match.turnDeadlineAt = null;
    match.reconnectDeadlineAt = null;
    room.phase = 'action_turn';
    this.setStatus(room, `Hand ${match.handNumber} is live.`);
    this.pushEvent(
      room,
      `New hand dealt. ${room.seats.find((seat) => seat.id === nextDealerSeatId)?.displayName ?? 'Lead seat'} starts.`,
    );
    this.scheduleTurnTimeout(room.code);
    this.persistAction(room, 'hand_prepared', {
      handNumber: match.handNumber,
      dealerSeatId: nextDealerSeatId,
    });
  }

  private getLegalWildcardChoices(
    room: MutableRoom,
    wildcardId: string,
  ): WildcardChoice[] {
    void wildcardId;
    const candidateChoices = this.createDeck()
      .filter((entry) => !entry.isWildcard)
      .map<WildcardChoice>((entry) => ({
        rank: entry.rank,
        suit: entry.suit,
        label: entry.label,
      }));
    const playedSignatures = new Set(
      (room.match?.tableCards ?? []).map((play) =>
        this.getCardSignature(play.card.rank, play.card.suit),
      ),
    );

    return candidateChoices.filter(
      (choice) =>
        !playedSignatures.has(this.getCardSignature(choice.rank, choice.suit)),
    );
  }

  private getWinningTeamForScore(
    scoreByTeam: TeamScoreView,
    targetScore: number,
  ): TeamSide | null {
    if (scoreByTeam.A < targetScore && scoreByTeam.B < targetScore) {
      return null;
    }

    if (scoreByTeam.A === scoreByTeam.B) {
      return null;
    }

    return scoreByTeam.A > scoreByTeam.B ? 'A' : 'B';
  }

  private isTrucoCanto(
    cantoType: MutablePendingCanto['cantoType'],
  ): cantoType is 'truco' | 'retruco' | 'vale_cuatro' {
    return (
      cantoType === 'truco' ||
      cantoType === 'retruco' ||
      cantoType === 'vale_cuatro'
    );
  }

  private validateCantoOpen(
    room: MutableRoom,
    cantoType: MutablePendingCanto['cantoType'],
  ) {
    if (!room.match || !this.isTrucoCanto(cantoType)) {
      return;
    }

    const targetPoints = this.getAcceptedTrucoPoints(cantoType);

    if (room.match.currentHandPoints >= targetPoints) {
      throw new Error(
        `${cantoType} is already active or surpassed for this hand.`,
      );
    }

    if (cantoType === 'retruco' && room.match.currentHandPoints < 2) {
      throw new Error('retruco can only be called after truco is accepted.');
    }

    if (cantoType === 'vale_cuatro' && room.match.currentHandPoints < 3) {
      throw new Error(
        'vale cuatro can only be called after retruco is accepted.',
      );
    }
  }

  private toChoiceId(label: string) {
    return label.trim().toLowerCase().replace(/\s+/g, '_');
  }

  private getPhaseDetail(room: MutableRoom) {
    const match = room.match;

    if (!match) {
      return room.phase === 'lobby' ? 'Waiting in lobby.' : null;
    }

    if (room.phase === 'response_pending' && match.pendingCanto) {
      return `${match.pendingCanto.cantoType} awaiting response.`;
    }

    if (room.phase === 'wildcard_selection' && match.pendingWildcardSelection) {
      return 'Wildcard selection pending.';
    }

    if (room.phase === 'reconnect_hold') {
      return 'Waiting for reconnect.';
    }

    if (room.phase === 'post_match_summary') {
      return 'Post-match summary is open.';
    }

    return match.statusText;
  }

  private getActiveActionSeatId(room: MutableRoom) {
    const match = room.match;

    if (!match) {
      return null;
    }

    if (room.phase === 'response_pending') {
      return match.pendingCanto?.targetSeatId ?? match.currentTurnSeatId;
    }

    if (room.phase === 'wildcard_selection') {
      return match.pendingWildcardSelection?.seatId ?? null;
    }

    return match.currentTurnSeatId;
  }

  private requireStringField(
    payload: Record<string, unknown>,
    fieldName: string,
  ) {
    const value = payload[fieldName];

    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Missing or invalid ${fieldName}.`);
    }

    return value;
  }

  private readOptionalStringField(
    payload: Record<string, unknown>,
    fieldName: string,
  ) {
    const value = payload[fieldName];

    if (typeof value === 'undefined' || value === null || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      throw new Error(`Invalid ${fieldName}.`);
    }

    return value;
  }

  private requireCantoType(value: unknown): MutablePendingCanto['cantoType'] {
    if (
      value === 'truco' ||
      value === 'retruco' ||
      value === 'vale_cuatro' ||
      value === 'envido' ||
      value === 'real_envido' ||
      value === 'falta_envido'
    ) {
      return value;
    }

    throw new Error('Missing or invalid cantoType.');
  }

  private requireCantoResponse(
    value: unknown,
  ): 'quiero' | 'no_quiero' | 'accepted' | 'rejected' {
    if (
      value === 'quiero' ||
      value === 'no_quiero' ||
      value === 'accepted' ||
      value === 'rejected'
    ) {
      return value;
    }

    throw new Error('Missing or invalid response.');
  }

  private requireSummarySource(
    value: unknown,
  ): 'manual' | 'match_end' | 'reconnect' {
    if (value === 'match_end' || value === 'reconnect') {
      return value;
    }

    return 'manual';
  }

  private getDeclinedCantoPoints(cantoType: MutablePendingCanto['cantoType']) {
    switch (cantoType) {
      case 'retruco':
        return 2;
      case 'vale_cuatro':
        return 3;
      case 'truco':
      case 'envido':
      case 'real_envido':
      case 'falta_envido':
      default:
        return 1;
    }
  }

  private getAcceptedTrucoPoints(
    cantoType: Extract<
      MutablePendingCanto['cantoType'],
      'truco' | 'retruco' | 'vale_cuatro'
    >,
  ) {
    switch (cantoType) {
      case 'retruco':
        return 3;
      case 'vale_cuatro':
        return 4;
      case 'truco':
      default:
        return 2;
    }
  }

  private getAcceptedEnvidoPoints(
    room: MutableRoom,
    cantoType: Extract<
      MutablePendingCanto['cantoType'],
      'envido' | 'real_envido' | 'falta_envido'
    >,
  ) {
    if (cantoType === 'falta_envido') {
      const leadingScore = Math.max(
        room.match?.teamScores.A ?? 0,
        room.match?.teamScores.B ?? 0,
      );
      return Math.max(1, room.targetScore - leadingScore);
    }

    return cantoType === 'real_envido' ? 3 : 2;
  }

  private getAcceptedEnvidoScoreDelta(
    room: MutableRoom,
    cantoType: Extract<
      MutablePendingCanto['cantoType'],
      'envido' | 'real_envido' | 'falta_envido'
    >,
  ): TeamScoreView {
    const awardedTeam = this.getEnvidoWinningTeam(room);
    const points = this.getAcceptedEnvidoPoints(room, cantoType);

    return {
      A: awardedTeam === 'A' ? points : 0,
      B: awardedTeam === 'B' ? points : 0,
    };
  }

  private getEnvidoWinningTeam(room: MutableRoom): TeamSide {
    const occupiedSeats = this.getOccupiedSeats(room);
    const bestByTeam: TeamScoreView = { A: 0, B: 0 };

    for (const seat of occupiedSeats) {
      if (!seat.teamSide || !room.match) {
        continue;
      }

      const hand = room.match.handsBySeatId[seat.id] ?? [];
      bestByTeam[seat.teamSide] = Math.max(
        bestByTeam[seat.teamSide],
        this.getSeatEnvidoScore(hand),
      );
    }

    if (bestByTeam.A === bestByTeam.B) {
      const dealerTeam = occupiedSeats.find(
        (seat) => seat.id === room.match?.dealerSeatId,
      )?.teamSide;
      return dealerTeam ?? 'A';
    }

    return bestByTeam.A > bestByTeam.B ? 'A' : 'B';
  }

  private getSeatEnvidoScore(hand: MutableCard[]) {
    const bySuit = new Map<CardSuit, number[]>();

    for (const card of hand) {
      const current = bySuit.get(card.suit) ?? [];
      current.push(this.getEnvidoCardValue(card.rank));
      bySuit.set(card.suit, current);
    }

    let best = 0;
    for (const values of bySuit.values()) {
      const sorted = [...values].sort((a, b) => b - a);
      if (sorted.length >= 2) {
        best = Math.max(best, 20 + sorted[0] + sorted[1]);
      } else if (sorted.length === 1) {
        best = Math.max(best, sorted[0]);
      }
    }

    return best;
  }

  private getEnvidoCardValue(rank: number) {
    return rank >= 10 ? 0 : Math.min(rank, 7);
  }

  private describeAwardedTeam(scoreDelta: TeamScoreView) {
    if (scoreDelta.A > 0) {
      return `team A won ${scoreDelta.A} point${scoreDelta.A === 1 ? '' : 's'}`;
    }

    if (scoreDelta.B > 0) {
      return `team B won ${scoreDelta.B} point${scoreDelta.B === 1 ? '' : 's'}`;
    }

    return 'no points were awarded';
  }

  private requireLegalWildcardSelectionByLabel(
    selectedLabel: string,
    legalChoices: WildcardChoice[],
  ) {
    const selectedChoice =
      legalChoices.find((choice) => choice.label === selectedLabel) ?? null;

    if (!selectedChoice) {
      throw new Error('Selected wildcard value is not legal.');
    }

    return selectedChoice;
  }

  private getCardSignature(rank: number, suit: CardSuit) {
    return `${rank}-${suit}`;
  }

  private getWinningPlay(tableCards: MutableTablePlay[]) {
    if (tableCards.length === 0) {
      return null;
    }
    if (tableCards.filter((play) => play.card.isWildcard).length >= 2) {
      return null;
    }
    let bestPlay = tableCards[0];
    let bestRank = this.getCardStrength(bestPlay.card);
    let isTie = false;

    for (let index = 1; index < tableCards.length; index += 1) {
      const play = tableCards[index];
      const strength = this.getCardStrength(play.card);

      if (strength > bestRank) {
        bestPlay = play;
        bestRank = strength;
        isTie = false;
      } else if (strength === bestRank) {
        isTie = true;
      }
    }

    return isTie ? null : bestPlay;
  }

  private getHandWinner(
    room: MutableRoom,
    match: MutableMatchState,
    trickNumber: number,
  ): TeamSide | null {
    if (match.handTrickWins.A >= 2) {
      return 'A';
    }

    if (match.handTrickWins.B >= 2) {
      return 'B';
    }

    if (trickNumber >= 3) {
      if (match.handTrickWins.A > match.handTrickWins.B) {
        return 'A';
      }

      if (match.handTrickWins.B > match.handTrickWins.A) {
        return 'B';
      }

      const dealerSeat = room.seats.find(
        (seat) => seat.id === match.dealerSeatId,
      );
      return dealerSeat?.teamSide ?? 'A';
    }

    return null;
  }

  private getAuthorizedSeat(code: string, roomSessionToken: string) {
    const room = this.getRequiredRoom(code);
    const actorSeat = room.seats.find(
      (entry) => entry.roomSessionToken === roomSessionToken,
    );

    if (!actorSeat) {
      throw new NotFoundException('Session not found.');
    }

    return { room, actorSeat };
  }

  private getOccupiedSeats(room: MutableRoom) {
    return room.seats.filter((seat) => seat.displayName);
  }

  private clearReadyState(room: MutableRoom) {
    for (const seat of room.seats) {
      if (seat.displayName) {
        seat.isReady = false;
      }
    }
  }

  private hasValidTeams(room: MutableRoom) {
    const occupiedSeats = this.getOccupiedSeats(room);
    const countA = occupiedSeats.filter((seat) => seat.teamSide === 'A').length;
    const countB = occupiedSeats.filter((seat) => seat.teamSide === 'B').length;

    if (room.maxPlayers === 2) {
      return countA === 1 && countB === 1;
    }

    if (room.maxPlayers === 4) {
      return countA === 2 && countB === 2;
    }

    return false;
  }

  private attachSeat(
    seat: MutableSeat,
    roomCode: string,
    roomId: string,
    displayName: string,
  ): RoomSession {
    const roomSessionToken = this.createToken();
    const seatClaimToken = this.createToken();

    seat.displayName = displayName;
    seat.roomSessionToken = roomSessionToken;
    seat.seatClaimToken = seatClaimToken;
    seat.status = 'occupied';
    seat.isReady = false;
    this.roomCodeByToken.set(roomSessionToken, roomCode);

    return {
      roomId,
      roomCode,
      seatId: seat.id,
      displayName,
      roomSessionToken,
      seatClaimToken,
    };
  }

  private persistRoomCreated(
    room: MutableRoom,
    hostSeat: MutableSeat,
    session: RoomSession,
  ) {
    void this.runPersist('persist room create', async () => {
      if (!this.roomPersistence) {
        return;
      }

      const persistedRoom = await this.roomPersistence.createRoom({
        code: room.code,
        maxPlayers: room.maxPlayers,
        targetScore: room.targetScore,
        allowBongs: room.allowBongs,
        allow3v3: room.allow3v3,
      });

      room.persistedRoomId = persistedRoom.id;

      for (const seat of room.seats) {
        const persistedSeat = persistedRoom.seats.find(
          (entry) => entry.seatIndex === seat.seatIndex,
        );
        seat.persistedSeatId = persistedSeat?.id ?? null;
      }

      const persistedHostSeatId =
        persistedRoom.seats.find(
          (entry) => entry.seatIndex === hostSeat.seatIndex,
        )?.id ??
        persistedRoom.hostSeatId ??
        null;

      if (persistedHostSeatId) {
        await this.roomPersistence.setHostSeat(
          persistedRoom.id,
          persistedHostSeatId,
        );
      }

      await this.claimSeatPersistence(room, hostSeat, session);
      await this.analyticsEventService?.roomCreated(persistedRoom.id, {
        code: room.code,
        maxPlayers: room.maxPlayers,
        targetScore: room.targetScore,
      });
      await this.actionLogPersistence?.append({
        roomId: persistedRoom.id,
        seatId: hostSeat.persistedSeatId ?? undefined,
        occupancyId: hostSeat.persistedOccupancyId ?? undefined,
        actionType: 'room_created',
        payload: {
          code: room.code,
          hostSeatId: hostSeat.id,
          displayName: hostSeat.displayName,
        },
      });
      await this.persistSnapshotNow(room);
    });
  }

  private persistSeatClaim(
    room: MutableRoom,
    seat: MutableSeat,
    session: RoomSession,
    actionType: string,
  ) {
    void this.runPersist(`persist ${actionType}`, async () => {
      const persistedRoomId = this.getPersistedRoomId(room);

      if (!persistedRoomId) {
        return;
      }

      await this.claimSeatPersistence(room, seat, session);
      await this.actionLogPersistence?.append({
        roomId: persistedRoomId,
        seatId: seat.persistedSeatId ?? undefined,
        occupancyId: seat.persistedOccupancyId ?? undefined,
        matchId: room.match?.persistedMatchId ?? undefined,
        actionType,
        payload: {
          seatId: seat.id,
          displayName: seat.displayName,
          teamSide: seat.teamSide,
        },
      });
      await this.persistSnapshotNow(room);
    });
  }

  private persistConnectionConnected(seat: MutableSeat, socketId: string) {
    void this.runPersist('persist connection connect', async () => {
      if (!seat.persistedOccupancyId || !this.connectionSessionPersistence) {
        return;
      }

      const reconnectToken = this.createToken();
      const connection = await this.connectionSessionPersistence.connect(
        seat.persistedOccupancyId,
        socketId,
        reconnectToken,
      );

      seat.persistedConnectionId = connection.id;
      seat.reconnectToken = reconnectToken;
    });
  }

  private persistConnectionDisconnected(socketId: string) {
    void this.runPersist('persist connection disconnect', async () => {
      await this.connectionSessionPersistence?.disconnectBySocketId(socketId);
    });
  }

  private persistReconnect(room: MutableRoom, seat: MutableSeat) {
    void this.runPersist('persist reconnect', async () => {
      if (seat.persistedSeatId) {
        await this.roomPersistence?.updateSeatStatus(
          seat.persistedSeatId,
          DbSeatStatus.OCCUPIED,
          seat.displayName,
        );
      }
      const persistedRoomId = this.getPersistedRoomId(room);

      if (!persistedRoomId) {
        return;
      }

      await this.analyticsEventService?.reconnectSuccess(persistedRoomId, {
        seatId: seat.id,
        displayName: seat.displayName,
      });
      await this.actionLogPersistence?.append({
        roomId: persistedRoomId,
        matchId: room.match?.persistedMatchId ?? undefined,
        seatId: seat.persistedSeatId ?? undefined,
        occupancyId: seat.persistedOccupancyId ?? undefined,
        actionType: 'seat_reconnected',
        payload: {
          seatId: seat.id,
          displayName: seat.displayName,
        },
      });
      await this.persistSnapshotNow(room);
    });
  }

  private persistMatchStarted(room: MutableRoom, actorSeat: MutableSeat) {
    void this.runPersist('persist match start', async () => {
      if (!room.match) {
        return;
      }

      const persistedRoomId = this.getPersistedRoomId(room);

      if (!persistedRoomId) {
        return;
      }

      const persistedMatch = await this.matchPersistence?.createMatch({
        roomId: persistedRoomId,
      });

      room.match.persistedMatchId = persistedMatch?.id ?? null;

      if (persistedMatch) {
        await this.matchPersistence?.startMatch(persistedMatch.id);
      }

      await this.roomPersistence?.setRoomStatus(
        persistedRoomId,
        DbRoomStatus.ACTIVE,
      );
      await this.analyticsEventService?.matchStarted(persistedRoomId, {
        roomCode: room.code,
        handNumber: room.match.handNumber,
      });
      await this.actionLogPersistence?.append({
        roomId: persistedRoomId,
        matchId: room.match.persistedMatchId ?? undefined,
        seatId: actorSeat.persistedSeatId ?? undefined,
        occupancyId: actorSeat.persistedOccupancyId ?? undefined,
        actionType: 'match_started',
        payload: {
          handNumber: room.match.handNumber,
          dealerSeatId: room.match.dealerSeatId,
        },
      });
      await this.persistSnapshotNow(room);
    });
  }

  private persistMatchFinished(room: MutableRoom, winnerTeamSide: TeamSide) {
    void this.runPersist('persist match finish', async () => {
      if (!room.match?.persistedMatchId) {
        return;
      }

      const persistedRoomId = this.getPersistedRoomId(room);

      if (!persistedRoomId) {
        return;
      }

      await this.matchPersistence?.finishMatch(room.match.persistedMatchId, {
        winnerTeamSide,
        finalScore: room.match.teamScores,
      });
      await this.roomPersistence?.setRoomStatus(
        persistedRoomId,
        DbRoomStatus.SUMMARY,
      );
      await this.analyticsEventService?.matchFinished(persistedRoomId, {
        winnerTeamSide,
        finalScore: this.toJson(room.match.teamScores),
      } as JsonInput);
      await this.actionLogPersistence?.append({
        roomId: persistedRoomId,
        matchId: room.match.persistedMatchId,
        actionType: 'match_finished',
        payload: this.toJson({
          winnerTeamSide,
          finalScore: room.match.teamScores,
        }),
      });
    });
  }

  private persistAction(
    room: MutableRoom,
    actionType: string,
    payload: Record<string, unknown>,
    seat?: MutableSeat,
  ) {
    void this.runPersist(`persist ${actionType}`, async () => {
      if (actionType === 'seat_disconnected' && seat?.persistedSeatId) {
        await this.roomPersistence?.releaseSeat(seat.persistedSeatId);
      }

      if (actionType === 'seat_reconnected' && seat?.persistedSeatId) {
        await this.roomPersistence?.updateSeatStatus(
          seat.persistedSeatId,
          DbSeatStatus.OCCUPIED,
          seat.displayName,
        );
      }

      const persistedRoomId = this.getPersistedRoomId(room);

      if (!persistedRoomId) {
        return;
      }

      await this.actionLogPersistence?.append({
        roomId: persistedRoomId,
        matchId: room.match?.persistedMatchId ?? undefined,
        seatId: seat?.persistedSeatId ?? undefined,
        occupancyId: seat?.persistedOccupancyId ?? undefined,
        actionType,
        payload: this.toJson(payload),
      });
    });
  }

  private persistSnapshot(room: MutableRoom) {
    void this.runPersist('persist snapshot', async () => {
      await this.persistSnapshotNow(room);
    });
  }

  private async persistSnapshotNow(room: MutableRoom) {
    if (!room.match) {
      const persistedRoomId = this.getPersistedRoomId(room);

      if (!persistedRoomId) {
        return;
      }

      room.snapshotVersion += 1;
      await this.roomPersistence?.storeRoomSnapshot(
        persistedRoomId,
        room.snapshotVersion,
        this.buildPersistenceState(room),
        null,
      );
      return;
    }

    const persistedRoomId = this.getPersistedRoomId(room);

    if (!persistedRoomId) {
      return;
    }

    room.match.snapshotVersion += 1;
    await this.matchPersistence?.createSnapshot({
      roomId: persistedRoomId,
      matchId: room.match.persistedMatchId ?? null,
      version: room.match.snapshotVersion,
      state: this.buildPersistenceState(room),
    });
  }

  private async claimSeatPersistence(
    room: MutableRoom,
    seat: MutableSeat,
    session: RoomSession,
  ) {
    if (!this.roomPersistence || !seat.persistedSeatId) {
      return;
    }

    await this.roomPersistence.updateSeatStatus(
      seat.persistedSeatId,
      DbSeatStatus.OCCUPIED,
      seat.displayName,
    );
    const occupancy = await this.roomPersistence.claimSeat({
      roomSeatId: seat.persistedSeatId,
      guestPlayerId: seat.id,
      roomSessionToken: session.roomSessionToken,
      seatClaimToken: session.seatClaimToken,
    });
    seat.persistedOccupancyId = occupancy.id;
  }

  private buildPersistenceState(room: MutableRoom): JsonInput {
    return this.toJson({
      room: this.buildSnapshot(room),
      match: room.match
        ? {
            handNumber: room.match.handNumber,
            trickNumber: room.match.trickNumber,
            dealerSeatId: room.match.dealerSeatId,
            currentTurnSeatId: room.match.currentTurnSeatId,
            handsBySeatId: room.match.handsBySeatId,
            tableCards: room.match.tableCards,
            teamScores: room.match.teamScores,
            handTrickWins: room.match.handTrickWins,
            currentHandPoints: room.match.currentHandPoints,
            trickResults: room.match.trickResults,
            recentEvents: room.match.recentEvents,
            statusText: room.match.statusText,
            summary: room.match.summary,
            lastTrickResolvedAt: room.match.lastTrickResolvedAt,
            lastHandScoredAt: room.match.lastHandScoredAt,
            lastHandWinnerTeamSide: room.match.lastHandWinnerTeamSide,
            turnDeadlineAt: room.match.turnDeadlineAt,
            reconnectDeadlineAt: room.match.reconnectDeadlineAt,
          }
        : null,
    });
  }

  private getPersistedRoomId(room: MutableRoom) {
    return room.persistedRoomId;
  }

  private toJson<T>(value: T): JsonInput {
    return JSON.parse(JSON.stringify(value)) as JsonInput;
  }

  private async runPersist(label: string, task: () => Promise<void>) {
    try {
      await task();
    } catch (error) {
      this.logger.warn(
        `${label} failed: ${error instanceof Error ? error.message : 'unknown persistence error'}`,
      );
    }
  }

  private createToken() {
    return randomBytes(18).toString('base64url');
  }

  private generateRoomCode() {
    let code = '';

    do {
      code = randomBytes(4)
        .toString('base64url')
        .replace(/[^A-Z0-9]/gi, '')
        .slice(0, 6)
        .toUpperCase();
    } while (code.length < 6 || this.roomsByCode.has(code));

    return code;
  }

  private createDeck(): MutableCard[] {
    const suits: CardSuit[] = ['espada', 'basto', 'oro', 'copa'];
    const ranks = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    const cards: MutableCard[] = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        cards.push({
          id: randomUUID(),
          suit,
          rank,
          label: `${rank} de ${suit}`,
          isWildcard: false,
        });
      }
    }

    for (let wildcardIndex = 0; wildcardIndex < 2; wildcardIndex += 1) {
      cards.push({
        id: randomUUID(),
        suit: 'copa',
        rank: 0,
        label: 'Comodin',
        isWildcard: true,
      });
    }

    return cards;
  }

  private getCardStrength(card: MutableCard) {
    if (card.isWildcard) {
      return 100;
    }

    const trucoStrength = `${card.rank}-${card.suit}`;
    const ranking: Record<string, number> = {
      '1-espada': 99,
      '1-basto': 98,
      '7-espada': 97,
      '7-oro': 96,
      '3-espada': 95,
      '3-basto': 95,
      '3-oro': 95,
      '3-copa': 95,
      '2-espada': 94,
      '2-basto': 94,
      '2-oro': 94,
      '2-copa': 94,
      '1-oro': 93,
      '1-copa': 93,
      '12-espada': 92,
      '12-basto': 92,
      '12-oro': 92,
      '12-copa': 92,
      '11-espada': 91,
      '11-basto': 91,
      '11-oro': 91,
      '11-copa': 91,
      '10-espada': 90,
      '10-basto': 90,
      '10-oro': 90,
      '10-copa': 90,
      '7-basto': 89,
      '7-copa': 89,
      '6-espada': 88,
      '6-basto': 88,
      '6-oro': 88,
      '6-copa': 88,
      '5-espada': 87,
      '5-basto': 87,
      '5-oro': 87,
      '5-copa': 87,
      '4-espada': 86,
      '4-basto': 86,
      '4-oro': 86,
      '4-copa': 86,
    };

    return ranking[trucoStrength] ?? 0;
  }

  private pushEvent(room: MutableRoom, message: string) {
    if (!room.match) {
      return;
    }

    room.match.recentEvents = [message, ...room.match.recentEvents].slice(0, 8);
  }

  private setStatus(room: MutableRoom, statusText: string) {
    if (!room.match) {
      return;
    }

    room.match.statusText = statusText;
  }

  private buildStatusText(room: MutableRoom) {
    if (!room.match) {
      return room.code;
    }

    const base = room.match.statusText;
    return room.match.currentHandPoints > 1
      ? `${base} Hand value: ${room.match.currentHandPoints}.`
      : base;
  }

  private shuffle<T>(items: T[]) {
    const clone = [...items];

    for (
      let currentIndex = clone.length - 1;
      currentIndex > 0;
      currentIndex -= 1
    ) {
      const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
      const current = clone[currentIndex];
      clone[currentIndex] = clone[randomIndex];
      clone[randomIndex] = current;
    }

    return clone;
  }

  private scheduleTurnTimeout(roomCode: string) {
    this.clearTurnTimeout(roomCode);
    const room = this.roomsByCode.get(roomCode);

    if (
      !room?.match ||
      room.phase !== 'action_turn' ||
      !room.match.currentTurnSeatId
    ) {
      return;
    }

    room.match.turnDeadlineAt = new Date(Date.now() + 10_000).toISOString();
    const timeout = setTimeout(() => {
      const latestRoom = this.roomsByCode.get(roomCode);

      if (
        !latestRoom?.match ||
        latestRoom.phase !== 'action_turn' ||
        !latestRoom.match.currentTurnSeatId
      ) {
        return;
      }

      const currentSeatId = latestRoom.match.currentTurnSeatId;
      const token = latestRoom.seats.find(
        (seat) => seat.id === currentSeatId,
      )?.roomSessionToken;
      const cardId = latestRoom.match.handsBySeatId[currentSeatId]?.[0]?.id;

      if (!token || !cardId) {
        return;
      }

      this.pushEvent(
        latestRoom,
        `Timer expired. Auto-playing for ${latestRoom.seats.find((seat) => seat.id === currentSeatId)?.displayName ?? 'player'}.`,
      );
      this.playCard({
        roomCode,
        roomSessionToken: token,
        cardId,
      });
    }, 10_000);
    timeout.unref?.();
    this.turnTimeouts.set(roomCode, timeout);
  }

  private clearTurnTimeout(roomCode: string) {
    const existing = this.turnTimeouts.get(roomCode);

    if (existing) {
      clearTimeout(existing);
      this.turnTimeouts.delete(roomCode);
    }
  }

  private scheduleReconnectTimeout(roomCode: string) {
    this.clearReconnectTimeout(roomCode);
    const room = this.roomsByCode.get(roomCode);

    if (!room?.match || room.phase !== 'reconnect_hold') {
      return;
    }

    const timeout = setTimeout(() => {
      const latestRoom = this.roomsByCode.get(roomCode);

      if (!latestRoom?.match || latestRoom.phase !== 'reconnect_hold') {
        return;
      }

      latestRoom.phase = 'action_turn';
      latestRoom.match.reconnectDeadlineAt = null;
      this.pushEvent(latestRoom, 'Reconnect window expired. Resuming match.');
      this.setStatus(
        latestRoom,
        `${latestRoom.seats.find((seat) => seat.id === latestRoom.match?.currentTurnSeatId)?.displayName ?? 'Current player'} to act.`,
      );
      this.scheduleTurnTimeout(roomCode);
    }, 10_000);
    timeout.unref?.();
    this.reconnectTimeouts.set(roomCode, timeout);
  }

  private clearReconnectTimeout(roomCode: string) {
    const existing = this.reconnectTimeouts.get(roomCode);

    if (existing) {
      clearTimeout(existing);
      this.reconnectTimeouts.delete(roomCode);
    }
  }

  private scheduleCantoTimeout(roomCode: string) {
    this.clearCantoTimeout(roomCode);
    const room = this.roomsByCode.get(roomCode);

    if (!room?.match?.pendingCanto || room.phase !== 'response_pending') {
      return;
    }

    const timeout = setTimeout(() => {
      const latestRoom = this.roomsByCode.get(roomCode);

      if (
        !latestRoom?.match?.pendingCanto ||
        latestRoom.phase !== 'response_pending'
      ) {
        return;
      }

      const pending = latestRoom.match.pendingCanto;
      const targetSeatId = pending.targetSeatId;
      const token = (
        targetSeatId
          ? latestRoom.seats.find((seat) => seat.id === targetSeatId)
          : latestRoom.seats[0]
      )?.roomSessionToken;

      if (!token) {
        return;
      }

      this.pushEvent(
        latestRoom,
        `Timer expired. ${pending.cantoType} resolved as no quiero.`,
      );
      this.resolveCanto(roomCode, token, 'no_quiero');
    }, 12_000);

    timeout.unref?.();
    this.cantoTimeouts.set(roomCode, timeout);
  }

  private clearCantoTimeout(roomCode: string) {
    const existing = this.cantoTimeouts.get(roomCode);

    if (existing) {
      clearTimeout(existing);
      this.cantoTimeouts.delete(roomCode);
    }
  }

  private scheduleWildcardTimeout(roomCode: string) {
    this.clearWildcardTimeout(roomCode);
    const room = this.roomsByCode.get(roomCode);

    if (
      !room?.match?.pendingWildcardSelection ||
      room.phase !== 'wildcard_selection'
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      const latestRoom = this.roomsByCode.get(roomCode);

      if (
        !latestRoom?.match?.pendingWildcardSelection ||
        latestRoom.phase !== 'wildcard_selection'
      ) {
        return;
      }

      const pending = latestRoom.match.pendingWildcardSelection;
      const token = latestRoom.seats.find(
        (seat) => seat.id === pending.seatId,
      )?.roomSessionToken;

      if (!token) {
        return;
      }

      this.pushEvent(
        latestRoom,
        'Timer expired. Wildcard auto-selected as 4 de copa.',
      );
      this.selectWildcard(roomCode, token, pending.cardId, '4 de copa');
    }, 15_000);

    timeout.unref?.();
    this.wildcardTimeouts.set(roomCode, timeout);
  }

  private clearWildcardTimeout(roomCode: string) {
    const existing = this.wildcardTimeouts.get(roomCode);

    if (existing) {
      clearTimeout(existing);
      this.wildcardTimeouts.delete(roomCode);
    }
  }
}
