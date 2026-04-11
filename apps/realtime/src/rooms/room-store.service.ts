import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ActionSubmitPayload,
  AvatarId,
  CardSuit,
  CreateRoomRequest,
  EnvidoSeatDeclaration,
  EnvidoSingingState,
  EnvidoWildcardCommitView,
  JoinRoomRequest,
  LobbyTeamPayload,
  MatchProgressState,
  MatchSummaryView,
  MatchView,
  NormalCardSuit,
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
  WildcardSelectionChoiceView,
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
    envidoResolved?: boolean;
    trucoOpened?: boolean;
    trickResults: MutableTrickResult[];
    pendingCanto?: MutablePendingCanto | null;
    suspendedCanto?: MutablePendingCanto | null;
    pendingWildcardSelection?: MutablePendingWildcardSelection | null;
    pendingEnvidoSinging?: MutableEnvidoSinging | null;
    recentEvents: string[];
    statusText: string;
    summary: MatchSummaryView | null;
    lastTrickResolvedAt?: string | null;
    lastHandScoredAt?: string | null;
    lastHandWinnerTeamSide?: TeamSide | null;
    turnDeadlineAt: string | null;
    reconnectDeadlineAt: string | null;
    activeBongBet?: { betterSeatId: string; targetSeatId: string } | null;
    bongBalance?: Record<string, number>;
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
  avatarId: AvatarId | null;
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
  envidoLock?: { rank: number; suit: NormalCardSuit; label: string } | null;
};

type WildcardChoice = {
  rank: number;
  suit: NormalCardSuit;
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

type MutableCantoType =
  | 'truco'
  | 'retruco'
  | 'vale_cuatro'
  | 'envido'
  | 'real_envido'
  | 'falta_envido';

type MutablePendingCanto = {
  cantoType: MutableCantoType;
  callChain: MutableCantoType[];
  actorSeatId: string;
  targetSeatId: string | null;
  openedAt: string;
  responseDeadlineAt: string | null;
  hasBong: boolean;
};

type MutablePendingWildcardSelection = {
  seatId: string;
  cardId: string;
  selectedLabel: string | null;
  availableLabels: string[];
  requestedAt: string;
  selectionDeadlineAt: string | null;
};

type MutableEnvidoWildcardCommit = {
  seatId: string;
  wildcardCardId: string;
  requestedAt: string;
  commitDeadlineAt: string | null;
};

type MutableEnvidoDeclaration = {
  seatId: string;
  teamSide: TeamSide;
  score: number;
  action: 'declared' | 'son_buenas';
  hasDimadong: boolean;
};

type MutableEnvidoSinging = {
  callerSeatId: string;
  callerTeamSide: TeamSide;
  quieroSeatId: string;
  cantoType: 'envido' | 'real_envido' | 'falta_envido';
  callChain: Array<'envido' | 'real_envido' | 'falta_envido'>;
  singingOrder: string[];
  declarations: MutableEnvidoDeclaration[];
  pendingWildcardCommits: MutableEnvidoWildcardCommit[];
  wildcardOverridesBySeatId: Record<
    string,
    { cardId: string; rank: number; suit: NormalCardSuit }
  >;
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
  envidoResolved: boolean;
  trucoOpened: boolean;
  trickResults: MutableTrickResult[];
  pendingCanto: MutablePendingCanto | null;
  suspendedCanto: MutablePendingCanto | null;
  pendingWildcardSelection: MutablePendingWildcardSelection | null;
  pendingEnvidoSinging: MutableEnvidoSinging | null;
  recentEvents: string[];
  statusText: string;
  summary: MatchSummaryView | null;
  lastTrickResolvedAt: string | null;
  lastHandScoredAt: string | null;
  lastHandWinnerTeamSide: TeamSide | null;
  turnDeadlineAt: string | null;
  reconnectDeadlineAt: string | null;
  activeBongBet: { betterSeatId: string; targetSeatId: string } | null;
  bongBalance: Record<string, number>;
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
  envidoSingingState: EnvidoSingingState | null;
};

type PlayCardResult = {
  snapshot: RoomSnapshot;
  lifecycle: RoomLifecycleState;
  trickResolved: boolean;
  handScored: boolean;
  summaryStarted: boolean;
  resolvedTableCards: Array<{
    seatId: string;
    card: {
      id: string;
      suit: CardSuit;
      rank: number;
      label: string;
      isWildcard: boolean;
    };
  }> | null;
};

type ResolveCantoResult = {
  snapshot: RoomSnapshot;
  lifecycle: RoomLifecycleState;
  scoreDelta: TeamScoreView;
  matchEnded: boolean;
  handValueChanged: boolean;
  envidoSinging: MutableEnvidoSinging | null;
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
  private static readonly RECONNECT_GRACE_MS = 20_000;
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
    const avatarId = input.avatarId ?? null;

    if (!displayName) {
      throw new BadRequestException('Display name is required.');
    }

    const maxPlayers = input.maxPlayers ?? 4;
    const targetScore = input.targetScore ?? 30;
    const allowBongs = input.allowBongs ?? true;
    const roomId = randomUUID();
    const code = this.generateRoomCode();
    const seats = this.createSeats(maxPlayers);
    const hostSeat = seats[0];
    const session = this.attachSeat(
      hostSeat,
      code,
      roomId,
      displayName,
      avatarId,
    );

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

  async joinRoom(
    code: string,
    input: JoinRoomRequest,
  ): Promise<RoomEntryResponse> {
    await this.restoreRoomIfNeeded(code);
    const room = this.getRequiredRoom(code);
    const displayName = input.displayName.trim();
    const avatarId = input.avatarId ?? null;

    if (!displayName) {
      throw new BadRequestException('Display name is required.');
    }

    const preferred =
      typeof input.preferredSeatIndex === 'number'
        ? room.seats.find(
            (entry) =>
              entry.seatIndex === input.preferredSeatIndex &&
              (entry.status === 'open' || entry.status === 'disconnected'),
          )
        : undefined;
    const seat =
      preferred ?? room.seats.find((entry) => entry.status === 'open');

    if (!seat) {
      throw new BadRequestException('Room is full.');
    }

    const isReplacement = seat.status === 'disconnected';
    const previousDisplayName = isReplacement ? seat.displayName : null;

    if (isReplacement && seat.roomSessionToken) {
      this.roomCodeByToken.delete(seat.roomSessionToken);
    }

    const session = this.attachSeat(
      seat,
      room.code,
      room.id,
      displayName,
      avatarId,
    );

    if (isReplacement) {
      this.pushEvent(
        room,
        `${displayName} reemplazó a ${previousDisplayName ?? 'jugador desconectado'}.`,
      );
      this.persistSeatClaim(room, seat, session, 'seat_replaced');
    } else {
      this.persistSeatClaim(room, seat, session, 'seat_joined');
    }

    return {
      snapshot: this.buildSnapshot(room),
      session,
    };
  }

  getSnapshot(code: string): RoomSnapshot {
    return this.buildSnapshot(this.getRequiredRoom(code));
  }

  getSeatHand(
    code: string,
    seatId: string,
  ): Array<{ id: string; isWildcard: boolean }> | null {
    const room = this.roomsByCode.get(code);
    return room?.match?.handsBySeatId[seatId] ?? null;
  }

  getWildcardAvailableChoices(
    code: string,
    seatId: string,
    wildcardCardId: string,
  ): WildcardSelectionChoiceView[] {
    const room = this.roomsByCode.get(code);
    if (!room?.match) return [];

    const hand = room.match.handsBySeatId[seatId] ?? [];
    const wildcardCard = hand.find(
      (c) => c.id === wildcardCardId && c.isWildcard,
    );
    if (!wildcardCard) return [];

    return this.getLegalWildcardChoices(room, wildcardCardId).map((c) => ({
      id: `${c.rank}-${c.suit}`,
      label: c.label,
    }));
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
      avatarId: seat.avatarId,
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

  async connectSession(
    code: string,
    roomSessionToken: string,
    socketId: string,
  ) {
    await this.restoreRoomIfNeeded(code);
    const room = this.getRequiredRoom(code);
    const seat = room.seats.find(
      (entry) => entry.roomSessionToken === roomSessionToken,
    );

    if (!seat) {
      throw new NotFoundException('Session not found.');
    }

    if (
      seat.status === 'occupied' &&
      seat.socketId &&
      seat.socketId !== socketId
    ) {
      // Allow same session token to take over with a fresh socket after network churn.
      // The stale socket (if still alive) becomes orphaned and will be ignored on disconnect.
      this.logger.debug(
        `Replacing stale socket ${seat.socketId} with ${socketId} for seat ${seat.id}`,
      );
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
        `${seat.displayName ?? 'Jugador'} reconectado. Le toca jugar.`,
      );
      this.scheduleTurnTimeout(room.code);
    }

    this.pushEvent(
      room,
      `${seat.displayName ?? 'Jugador'} volvió a conectarse.`,
    );
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
        this.pushEvent(room, `${seat.displayName ?? 'Jugador'} se desconectó.`);
        if (
          room.match &&
          room.phase === 'action_turn' &&
          room.match.currentTurnSeatId === seat.id
        ) {
          room.phase = 'reconnect_hold';
          room.match.reconnectDeadlineAt = new Date(
            Date.now() + RoomStoreService.RECONNECT_GRACE_MS,
          ).toISOString();
          room.match.turnDeadlineAt = null;
          this.clearTurnTimeout(room.code);
          this.setStatus(
            room,
            `Esperando que ${seat.displayName ?? 'jugador'} se reconecte.`,
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
      currentHandPoints: room.match.currentHandPoints,
      envidoResolved: room.match.envidoResolved,
      trucoOpened: room.match.trucoOpened,
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
          'Jugador',
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
          ? `El Equipo ${match.lastHandWinnerTeamSide} ganó la mano ${match.handNumber}.`
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
    const room = this.roomsByCode.get(code) ?? null;
    return {
      matchView: seatId ? this.getMatchView(code, seatId) : null,
      progressState: this.getMatchProgressState(code),
      transitionState: this.getMatchTransitionState(code),
      wildcardSelectionState: this.getPendingWildcardSelectionState(code),
      envidoSingingState: room ? this.buildEnvidoSingingState(room) : null,
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
        const withBong = payload.payload.withBong === true;

        return this.openCanto(
          roomCode,
          payload.roomSessionToken,
          cantoType,
          targetSeatId,
          withBong,
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
      case 'wildcard_commit_envido': {
        const wildcardCardId = this.requireStringField(
          payload.payload,
          'wildcardCardId',
        );
        const rank = this.requireNumberField(payload.payload, 'rank');
        const suit = this.requireCardSuit(payload.payload.suit);

        return this.commitWildcardForEnvido(
          roomCode,
          payload.roomSessionToken,
          wildcardCardId,
          rank,
          suit,
        ).snapshot;
      }
      default:
        throw new BadRequestException(
          `Unsupported action type: ${payload.actionType}`,
        );
    }
  }

  toggleReady(code: string, roomSessionToken: string) {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (room.phase !== 'lobby') {
      throw new BadRequestException(
        'Ready state can only be changed while the room is in the lobby.',
      );
    }

    actorSeat.isReady = !actorSeat.isReady;
    actorSeat.status = 'occupied';
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Jugador'} está ${actorSeat.isReady ? 'listo' : 'no listo'}.`,
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
      throw new BadRequestException(
        'Only the host can change team assignments.',
      );
    }

    if (room.phase !== 'lobby') {
      throw new BadRequestException(
        'Teams can only be edited while the room is in the lobby.',
      );
    }

    const targetSeat = room.seats.find(
      (entry) => entry.id === payload.targetSeatId,
    );

    if (!targetSeat) {
      throw new BadRequestException('Seat not found.');
    }

    targetSeat.teamSide = payload.teamSide;
    this.clearReadyState(room);
    this.pushEvent(
      room,
      `${targetSeat.displayName ?? 'Asiento'} pasó al Equipo ${payload.teamSide}.`,
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
      throw new BadRequestException('Only the host can start the match.');
    }

    if (room.phase !== 'lobby') {
      throw new BadRequestException('Match has already started.');
    }

    const occupiedSeats = this.getOccupiedSeats(room);

    if (occupiedSeats.length !== room.maxPlayers) {
      throw new BadRequestException(
        'All seats must be filled before the match can start.',
      );
    }

    if (!occupiedSeats.every((seat) => seat.isReady)) {
      throw new BadRequestException(
        'Every player must mark ready before the match can start.',
      );
    }

    if (!this.hasValidTeams(room)) {
      throw new BadRequestException(
        'Teams must be balanced before starting the match.',
      );
    }

    room.match = this.createInitialMatch(room);
    room.phase = 'action_turn';
    this.pushEvent(room, '¡Partida iniciada! Se repartieron las cartas.');
    this.setStatus(room, 'Mano 1 en juego.');
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
      throw new BadRequestException(
        'Summary is only available after the match ends.',
      );
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
      `Resumen abierto por ${actorSeat.displayName ?? 'jugador'}.`,
    );
    this.pushEvent(room, 'Mostrando resumen de la partida.');
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
    withBong?: boolean,
  ) {
    return this.openCantoWithResult(
      code,
      roomSessionToken,
      cantoType,
      targetSeatId,
      withBong,
    ).snapshot;
  }

  openCantoWithResult(
    code: string,
    roomSessionToken: string,
    cantoType: MutablePendingCanto['cantoType'],
    targetSeatId?: string | null,
    withBong?: boolean,
  ): OpenCantoResult {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);
    const interruptedPendingTruco = this.canInterruptPendingTrucoWithEnvido(
      room,
      actorSeat.id,
      cantoType,
    )
      ? (room.match?.pendingCanto ?? null)
      : null;

    const isRaisingTruco = this.canRaiseTruco(room, actorSeat.id, cantoType);
    const isRaisingEnvido = this.canRaiseEnvido(room, actorSeat.id, cantoType);

    if (
      (!interruptedPendingTruco &&
        !isRaisingTruco &&
        !isRaisingEnvido &&
        room.phase !== 'action_turn') ||
      !room.match
    ) {
      throw new BadRequestException(
        'Cantos can only be opened during an active turn.',
      );
    }

    if (
      !interruptedPendingTruco &&
      !isRaisingTruco &&
      !isRaisingEnvido &&
      room.match.currentTurnSeatId !== actorSeat.id
    ) {
      throw new BadRequestException('Only the active player can open a canto.');
    }

    if (
      room.match.pendingCanto &&
      !interruptedPendingTruco &&
      !isRaisingTruco &&
      !isRaisingEnvido
    ) {
      throw new BadRequestException(
        'There is already a pending canto response.',
      );
    }

    // When raising truco, implicitly accept the previous call so validation passes
    const raisedFromCanto = isRaisingTruco
      ? (room.match.pendingCanto ?? null)
      : null;
    if (raisedFromCanto && this.isTrucoCanto(raisedFromCanto.cantoType)) {
      room.match.currentHandPoints = Math.max(
        room.match.currentHandPoints,
        this.getAcceptedTrucoPoints(raisedFromCanto.cantoType),
      );
      room.match.pendingCanto = null;
    }

    const raisedEnvidoFromCanto = isRaisingEnvido
      ? (room.match.pendingCanto ?? null)
      : null;
    if (
      raisedEnvidoFromCanto &&
      !this.isTrucoCanto(raisedEnvidoFromCanto.cantoType)
    ) {
      room.match.pendingCanto = null;
    }

    this.validateCantoOpen(room, cantoType, actorSeat.id);

    if (this.isTrucoCanto(cantoType)) {
      room.match.trucoOpened = true;
    }

    room.phase = 'response_pending';
    room.match.suspendedCanto = interruptedPendingTruco;
    const callChain = raisedEnvidoFromCanto
      ? [...this.getPendingCantoCallChain(raisedEnvidoFromCanto), cantoType]
      : [cantoType];
    room.match.pendingCanto = {
      cantoType,
      callChain,
      actorSeatId: actorSeat.id,
      targetSeatId:
        raisedFromCanto?.actorSeatId ??
        raisedEnvidoFromCanto?.actorSeatId ??
        interruptedPendingTruco?.actorSeatId ??
        targetSeatId ??
        null,
      openedAt: new Date().toISOString(),
      responseDeadlineAt: new Date(Date.now() + 12_000).toISOString(),
      hasBong:
        (withBong ?? false) && room.allowBongs && this.isTrucoCanto(cantoType),
    };
    room.match.turnDeadlineAt = null;
    room.match.reconnectDeadlineAt = null;
    this.clearTurnTimeout(room.code);
    this.scheduleCantoTimeout(room.code);
    this.setStatus(
      room,
      `${actorSeat.displayName ?? 'Jugador'} cantó ${cantoType}.`,
    );
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Jugador'} cantó ${cantoType}.`,
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
      throw new BadRequestException('There is no pending canto to resolve.');
    }

    const pending = room.match.pendingCanto;
    const suspendedCanto = room.match.suspendedCanto;
    const actorTeamSide = actorSeat.teamSide;
    const callerTeamSide =
      room.seats.find((seat) => seat.id === pending.actorSeatId)?.teamSide ??
      null;

    if (pending.targetSeatId && pending.targetSeatId !== actorSeat.id) {
      throw new BadRequestException(
        'This canto must be resolved by the targeted seat.',
      );
    }

    if (
      !pending.targetSeatId &&
      actorTeamSide !== null &&
      actorTeamSide === callerTeamSide
    ) {
      throw new BadRequestException(
        'Only the opposing team can respond to this canto.',
      );
    }

    room.match.pendingCanto = null;
    room.match.reconnectDeadlineAt = null;
    this.clearCantoTimeout(room.code);

    const pendingCallChain = this.getPendingCantoCallChain(pending);

    if (!this.isTrucoCanto(pending.cantoType)) {
      room.match.envidoResolved = true;
    }

    const normalizedResponse =
      response === 'quiero' || response === 'accepted' ? 'quiero' : 'no_quiero';
    const declinedTruco =
      normalizedResponse === 'no_quiero' &&
      this.isTrucoCanto(pending.cantoType);
    let scoreDelta =
      normalizedResponse === 'no_quiero' && callerTeamSide
        ? {
            A:
              callerTeamSide === 'A'
                ? this.getDeclinedCantoPoints(
                    pending.cantoType,
                    room,
                    pendingCallChain,
                  )
                : 0,
            B:
              callerTeamSide === 'B'
                ? this.getDeclinedCantoPoints(
                    pending.cantoType,
                    room,
                    pendingCallChain,
                  )
                : 0,
          }
        : { A: 0, B: 0 };

    let envidoSinging: MutableEnvidoSinging | null = null;
    let handEndedByDeclinedTruco = false;

    if (scoreDelta.A > 0 || scoreDelta.B > 0) {
      // no_quiero — caller earns declined points immediately
      room.match.teamScores = {
        A: room.match.teamScores.A + scoreDelta.A,
        B: room.match.teamScores.B + scoreDelta.B,
      };
      this.pushEvent(
        room,
        `${actorSeat.displayName ?? 'Jugador'} no quiso el ${pending.cantoType}.`,
      );
      if (declinedTruco && callerTeamSide) {
        handEndedByDeclinedTruco = true;
        room.match.lastHandWinnerTeamSide = callerTeamSide;
        room.match.lastHandScoredAt = new Date().toISOString();
        room.match.currentTurnSeatId = null;
        room.match.tableCards = [];
        room.match.turnDeadlineAt = null;
        room.match.reconnectDeadlineAt = null;
        this.pushEvent(
          room,
          `El Equipo ${callerTeamSide} ganó la mano ${room.match.handNumber} por no quiero al ${pending.cantoType}.`,
        );
        this.settleBongBet(room, callerTeamSide);
      }
    } else {
      if (this.isTrucoCanto(pending.cantoType)) {
        room.match.currentHandPoints = Math.max(
          room.match.currentHandPoints,
          this.getAcceptedTrucoPoints(pending.cantoType),
        );
        this.pushEvent(
          room,
          `${actorSeat.displayName ?? 'Jugador'} aceptó el ${pending.cantoType}.`,
        );
        if (pending.hasBong) {
          room.match.activeBongBet = {
            betterSeatId: pending.actorSeatId,
            targetSeatId: actorSeat.id,
          };
          this.pushEvent(
            room,
            `BONG: ${room.seats.find((s) => s.id === pending.actorSeatId)?.displayName ?? 'Jugador'} apostó un BONG — se juega en la mano.`,
          );
        }
      } else {
        // Envido accepted — enter the singing phase instead of scoring immediately
        this.pushEvent(
          room,
          `${actorSeat.displayName ?? 'Jugador'} quiso el ${pending.cantoType}. Comienza el canto.`,
        );
        envidoSinging = this.buildEnvidoSinging(room, pending, actorSeat);
        room.match.pendingEnvidoSinging = envidoSinging;

        if (envidoSinging.pendingWildcardCommits.length > 0) {
          // Pause for dimadong commits before singing
          room.phase = 'envido_wildcard_commit';
          room.match.currentTurnSeatId = null;
          room.match.turnDeadlineAt = null;
          this.clearTurnTimeout(room.code);
          this.setStatus(
            room,
            'Esperando que los jugadores definan sus dimadong para el envido.',
          );
        } else {
          // No wildcards — compute declarations immediately and score
          const declarations = this.computeEnvidoDeclarations(
            room,
            envidoSinging,
          );
          scoreDelta = this.applyEnvidoDeclarations(
            room,
            envidoSinging,
            declarations,
          );
          room.match.pendingEnvidoSinging = null;
        }
      }
    }

    // Only handle win/continue logic if we're not waiting for wildcard commits
    if (room.phase !== 'envido_wildcard_commit') {
      const winningTeam = this.getWinningTeamForScore(
        room.match.teamScores,
        room.targetScore,
      );

      if (winningTeam) {
        room.phase = 'match_end';
        room.match.currentTurnSeatId = null;
        room.match.turnDeadlineAt = null;
        room.match.reconnectDeadlineAt = null;
        room.match.suspendedCanto = null;
        room.match.lastHandScoredAt = new Date().toISOString();
        room.match.lastHandWinnerTeamSide = winningTeam;
        room.match.summary = {
          winnerTeamSide: winningTeam,
          finalScore: { ...room.match.teamScores },
        };
        this.clearTurnTimeout(room.code);
        this.clearReconnectTimeout(room.code);
        this.setStatus(room, `El Equipo ${winningTeam} ganó la partida.`);
        this.pushEvent(
          room,
          `¡Partida terminada! El Equipo ${winningTeam} llegó a ${room.targetScore} puntos.`,
        );
        this.persistMatchFinished(room, winningTeam);
      } else {
        if (handEndedByDeclinedTruco) {
          this.prepareNextHand(room);
        } else if (suspendedCanto) {
          room.phase = 'response_pending';
          room.match.pendingCanto = {
            ...suspendedCanto,
            responseDeadlineAt: new Date(Date.now() + 12_000).toISOString(),
          };
          room.match.suspendedCanto = null;
          room.match.turnDeadlineAt = null;
          this.setStatus(
            room,
            `Se resolvió el ${pending.cantoType}. Queda pendiente la respuesta al ${suspendedCanto.cantoType}.`,
          );
          this.scheduleCantoTimeout(room.code);
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
            envidoSinging,
            matchEnded: Boolean(
              afterTransition?.matchComplete &&
              !beforeTransition?.matchComplete,
            ),
            handValueChanged:
              (room.match?.currentHandPoints ?? beforeHandPoints) !==
              beforeHandPoints,
          };
        }

        room.phase = 'action_turn';
        room.match.turnDeadlineAt = null;
        this.setStatus(
          room,
          normalizedResponse === 'no_quiero'
            ? `La mano continúa tras el ${pending.cantoType}.`
            : `${actorSeat.displayName ?? 'Jugador'} aceptó el ${pending.cantoType}.`,
        );
        this.scheduleTurnTimeout(room.code);
      }
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
      envidoSinging,
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
      throw new BadRequestException(
        'Wildcard selection is only available during an active hand.',
      );
    }

    if (room.match.currentTurnSeatId !== actorSeat.id) {
      throw new BadRequestException(
        'Only the active player can select a wildcard.',
      );
    }

    const card = (room.match.handsBySeatId[actorSeat.id] ?? []).find(
      (entry) => entry.id === cardId,
    );

    if (!card?.isWildcard) {
      throw new BadRequestException('Selected card is not a wildcard.');
    }

    // If the wildcard was committed for envido, it must keep that value for truco — no free choice.
    if (card.envidoLock) {
      card.label = card.envidoLock.label;
      card.rank = card.envidoLock.rank;
      card.suit = card.envidoLock.suit;
      card.isWildcard = false;
      card.envidoLock = null;
      this.setStatus(
        room,
        `${actorSeat.displayName ?? 'Jugador'} juega DIMADONG fijado como ${card.label} (comprometido en envido).`,
      );
      this.pushEvent(
        room,
        `${actorSeat.displayName ?? 'Jugador'} juega el DIMADONG como ${card.label} (fijado por envido).`,
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
    room.match.reconnectDeadlineAt = null;
    this.clearTurnTimeout(room.code);
    this.scheduleWildcardTimeout(room.code);
    this.setStatus(
      room,
      `${actorSeat.displayName ?? 'Jugador'} está eligiendo el valor del DIMADONG.`,
    );
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Jugador'} está eligiendo valor del DIMADONG.`,
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
      throw new BadRequestException('There is no pending wildcard selection.');
    }

    const pending = room.match.pendingWildcardSelection;

    if (pending.seatId !== actorSeat.id || pending.cardId !== cardId) {
      throw new BadRequestException(
        'This wildcard selection does not belong to the current player.',
      );
    }

    const card = (room.match.handsBySeatId[actorSeat.id] ?? []).find(
      (entry) => entry.id === cardId,
    );

    if (!card) {
      throw new BadRequestException('Wildcard card not found in hand.');
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
      `${actorSeat.displayName ?? 'Jugador'} eligió ${selectedLabel}.`,
    );
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Jugador'} eligió ${selectedLabel} para el DIMADONG.`,
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
      throw new BadRequestException('Only the host can destroy the room.');
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
      throw new BadRequestException(
        'Cards can only be played during an active turn.',
      );
    }

    if (room.match.currentTurnSeatId !== actorSeat.id) {
      throw new BadRequestException('It is not your turn.');
    }

    if (room.match.pendingCanto) {
      throw new BadRequestException(
        'Card play is blocked while a canto response is pending.',
      );
    }

    const hand = room.match.handsBySeatId[actorSeat.id] ?? [];
    const cardIndex = hand.findIndex((card) => card.id === payload.cardId);

    if (cardIndex === -1) {
      throw new BadRequestException('Card not found in hand.');
    }

    const [card] = hand.splice(cardIndex, 1);
    room.match.tableCards.push({ seatId: actorSeat.id, card });
    this.pushEvent(
      room,
      `${actorSeat.displayName ?? 'Jugador'} jugó ${card.label}.`,
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
    let resolvedTableCards: PlayCardResult['resolvedTableCards'] = null;

    if (room.match.tableCards.length >= occupiedSeats.length) {
      resolvedTableCards = room.match.tableCards.map((play) => ({
        seatId: play.seatId,
        card: {
          id: play.card.id,
          suit: play.card.suit,
          rank: play.card.rank,
          label: play.card.label,
          isWildcard: play.card.isWildcard,
        },
      }));
      this.resolveCurrentTrick(room);
    } else {
      room.match.currentTurnSeatId = nextSeat?.id ?? null;
      this.setStatus(
        room,
        `Le toca a ${room.seats.find((seat) => seat.id === room.match?.currentTurnSeatId)?.displayName ?? 'siguiente jugador'}.`,
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
      resolvedTableCards,
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

    try {
      const persistedRoom =
        await this.roomPersistence.findRoomByCode(normalizedCode);

      if (!persistedRoom) {
        this.logger.warn(
          `restoreRoomIfNeeded: room ${normalizedCode} not found in DB`,
        );
        return;
      }

      if (!persistedRoom.snapshots[0]?.state) {
        // No snapshot saved yet — possible race condition on first persist.
        // For lobby rooms we can reconstruct a joinable state from the DB record.
        if (persistedRoom.status === DbRoomStatus.LOBBY) {
          this.logger.warn(
            `restoreRoomIfNeeded: room ${normalizedCode} has no snapshot — reconstructing from DB record`,
          );
          const restoredRoom = this.hydrateRoomFromDbRecord(persistedRoom);
          this.roomsByCode.set(normalizedCode, restoredRoom);
          this.restoreTransientTimers(normalizedCode);
        } else {
          this.logger.warn(
            `restoreRoomIfNeeded: room ${normalizedCode} has no snapshot (status: ${persistedRoom.status}) — cannot restore`,
          );
        }
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
      this.restoreTransientTimers(normalizedCode);
    } catch (error) {
      this.logger.warn(
        `Failed to restore room ${normalizedCode} from persistence: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
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
        avatarId: seat.avatarId,
        isHost: seat.isHost,
        isReady: seat.isReady,
        handCount: room.match?.handsBySeatId[seat.id]?.length ?? 0,
        bongBalance: room.match?.bongBalance[seat.id] ?? 0,
      })),
      score: room.match?.teamScores ?? { A: 0, B: 0 },
      recentEvents: room.match?.recentEvents ?? [],
      statusText: room.match?.statusText ?? 'Esperando en el lobby.',
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
        avatarId: null,
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

      // If no current occupancy exists in DB, the seat is reclaimable —
      // reset it to open so new players can join (e.g. after server restart
      // with an incognito player whose session token is gone).
      const hasActiveOccupancy = !!occupancy;

      return {
        id: seatSnapshot.id,
        persistedSeatId: persistedSeat?.id ?? null,
        persistedOccupancyId: occupancy?.id ?? null,
        persistedConnectionId: latestConnection?.id ?? null,
        reconnectToken: latestConnection?.reconnectToken ?? null,
        seatIndex: seatSnapshot.seatIndex,
        teamSide: seatSnapshot.teamSide,
        status: hasActiveOccupancy ? seatSnapshot.status : 'open',
        displayName: hasActiveOccupancy ? seatSnapshot.displayName : null,
        avatarId: hasActiveOccupancy ? (seatSnapshot.avatarId ?? null) : null,
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
          envidoResolved: state.match.envidoResolved ?? false,
          trucoOpened: state.match.trucoOpened ?? false,
          trickResults: state.match.trickResults,
          pendingCanto: state.match.pendingCanto ?? null,
          suspendedCanto: state.match.suspendedCanto ?? null,
          pendingWildcardSelection:
            state.match.pendingWildcardSelection ?? null,
          pendingEnvidoSinging: state.match.pendingEnvidoSinging ?? null,
          recentEvents: state.match.recentEvents,
          statusText: state.match.statusText,
          summary: state.match.summary,
          lastTrickResolvedAt: state.match.lastTrickResolvedAt ?? null,
          lastHandScoredAt: state.match.lastHandScoredAt ?? null,
          lastHandWinnerTeamSide: state.match.lastHandWinnerTeamSide ?? null,
          turnDeadlineAt: state.match.turnDeadlineAt,
          reconnectDeadlineAt: state.match.reconnectDeadlineAt,
          activeBongBet: state.match.activeBongBet ?? null,
          bongBalance: state.match.bongBalance ?? {},
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

  private hydrateRoomFromDbRecord(
    persistedRoom: NonNullable<
      Awaited<ReturnType<RoomPersistenceService['findRoomByCode']>>
    >,
  ): MutableRoom {
    const seats = [...persistedRoom.seats]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map<MutableSeat>((persistedSeat) => {
        const occupancy = persistedSeat.occupancies[0];
        const latestConnection = occupancy?.connections[0];
        const seatId = randomUUID();

        if (occupancy?.roomSessionToken) {
          this.roomCodeByToken.set(
            occupancy.roomSessionToken,
            persistedRoom.code,
          );
        }

        const hasActiveOccupancy = !!occupancy;
        // DbSeatStatus values are uppercase; contracts SeatStatus values are lowercase
        const contractStatus = (
          hasActiveOccupancy ? persistedSeat.status.toLowerCase() : 'open'
        ) as SeatStatus;

        return {
          id: seatId,
          persistedSeatId: persistedSeat.id,
          persistedOccupancyId: occupancy?.id ?? null,
          persistedConnectionId: latestConnection?.id ?? null,
          reconnectToken: latestConnection?.reconnectToken ?? null,
          seatIndex: persistedSeat.seatIndex,
          teamSide: persistedSeat.teamSide as TeamSide | null,
          status: contractStatus,
          displayName: hasActiveOccupancy
            ? (persistedSeat.displayName ?? null)
            : null,
          avatarId: null,
          isHost: false,
          isReady: false,
          roomSessionToken: occupancy?.roomSessionToken ?? null,
          seatClaimToken: occupancy?.seatClaimToken ?? null,
          socketId: null,
        };
      });

    // Match host by persisted seat ID since we just generated new in-memory IDs
    const hostSeat = persistedRoom.hostSeatId
      ? seats.find((s) => s.persistedSeatId === persistedRoom.hostSeatId)
      : seats[0];

    if (hostSeat) {
      hostSeat.isHost = true;
    }

    return {
      id: randomUUID(),
      persistedRoomId: persistedRoom.id,
      snapshotVersion: 0,
      code: persistedRoom.code,
      phase: 'lobby',
      hostSeatId: hostSeat?.id ?? null,
      maxPlayers: persistedRoom.maxPlayers,
      targetScore: persistedRoom.targetScore,
      allowBongs: persistedRoom.allowBongs,
      allow3v3: persistedRoom.allow3v3,
      seats,
      match: null,
    };
  }

  private createInitialMatch(room: MutableRoom): MutableMatchState {
    const occupiedSeats = this.getOccupiedSeats(room);
    const deck = this.shuffle(this.createDeck());
    const handsBySeatId: Record<string, MutableCard[]> = {};
    const firstSeatId = occupiedSeats[0]?.id ?? null;

    for (const seat of occupiedSeats) {
      handsBySeatId[seat.id] = deck.splice(0, 3);
      seat.isReady = false;
    }

    return {
      persistedMatchId: null,
      snapshotVersion: room.snapshotVersion,
      handNumber: 1,
      trickNumber: 1,
      dealerSeatId: firstSeatId,
      currentTurnSeatId: firstSeatId,
      handsBySeatId,
      tableCards: [],
      teamScores: { A: 0, B: 0 },
      handTrickWins: { A: 0, B: 0 },
      currentHandPoints: 1,
      envidoResolved: false,
      trucoOpened: false,
      trickResults: [],
      pendingCanto: null,
      suspendedCanto: null,
      pendingWildcardSelection: null,
      pendingEnvidoSinging: null,
      recentEvents: [],
      statusText: `Le toca a ${occupiedSeats[0]?.displayName ?? 'primer jugador'}.`,
      summary: null,
      lastTrickResolvedAt: null,
      lastHandScoredAt: null,
      lastHandWinnerTeamSide: null,
      turnDeadlineAt: null,
      reconnectDeadlineAt: null,
      activeBongBet: null,
      bongBalance: Object.fromEntries(occupiedSeats.map((s) => [s.id, 0])),
    };
  }

  private resolveCurrentTrick(room: MutableRoom) {
    const match = room.match;

    if (!match) {
      return;
    }

    const trickLeadSeatId =
      match.tableCards[0]?.seatId ?? match.currentTurnSeatId;
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
        ? `${winningSeat.displayName ?? 'Jugador'} ganó la vuelta ${trickNumber} con ${winningPlay?.card.label ?? 'una carta'}.`
        : `La vuelta ${trickNumber} fue empate.`,
    );

    const handWinner = this.getHandWinner(room, match, trickNumber);
    const nextTrickSeatId =
      winningSeat?.id ??
      trickLeadSeatId ??
      this.getHandStarterSeatId(room, match);

    if (handWinner) {
      match.teamScores[handWinner] += match.currentHandPoints;
      match.lastHandWinnerTeamSide = handWinner;
      match.lastHandScoredAt = new Date().toISOString();
      match.currentTurnSeatId = null;
      match.tableCards = [];
      match.turnDeadlineAt = null;
      match.reconnectDeadlineAt = null;
      this.pushEvent(
        room,
        `El Equipo ${handWinner} ganó la mano ${match.handNumber} por ${match.currentHandPoints} punto${match.currentHandPoints === 1 ? '' : 's'}.`,
      );
      this.settleBongBet(room, handWinner);
      this.persistAction(room, 'trick_resolved', {
        trickNumber,
        winnerSeatId: winningSeat?.id ?? null,
        winnerTeamSide: winningTeamSide,
        winningCardLabel: winningPlay?.card.label ?? null,
      });

      if (match.teamScores[handWinner] >= room.targetScore) {
        room.phase = 'match_end';
        match.summary = {
          winnerTeamSide: handWinner,
          finalScore: { ...match.teamScores },
        };
        this.clearTurnTimeout(room.code);
        this.clearReconnectTimeout(room.code);
        this.setStatus(room, `El Equipo ${handWinner} ganó la partida.`);
        this.pushEvent(
          room,
          `¡Partida terminada! El Equipo ${handWinner} llegó a ${room.targetScore} puntos.`,
        );
        this.persistMatchFinished(room, handWinner);
        this.persistSnapshot(room);
        return;
      }

      this.prepareNextHand(room);
      return;
    }

    match.tableCards = [];
    match.trickNumber += 1;
    match.currentTurnSeatId = nextTrickSeatId;
    match.turnDeadlineAt = null;
    match.reconnectDeadlineAt = null;
    this.setStatus(
      room,
      `Le toca a ${room.seats.find((seat) => seat.id === nextTrickSeatId)?.displayName ?? 'siguiente jugador'} en la vuelta ${match.trickNumber}.`,
    );
    this.scheduleTurnTimeout(room.code);
    this.persistAction(room, 'trick_resolved', {
      trickNumber,
      winnerSeatId: winningSeat?.id ?? null,
      winnerTeamSide: winningTeamSide,
      winningCardLabel: winningPlay?.card.label ?? null,
    });
  }

  private prepareNextHand(room: MutableRoom) {
    const match = room.match;

    if (!match) {
      return;
    }

    const occupiedSeats = this.getOccupiedSeats(room);
    const deck = this.shuffle(this.createDeck());
    const handsBySeatId: Record<string, MutableCard[]> = {};
    const nextDealerSeatId = this.getNextOccupiedSeatId(
      room,
      match.dealerSeatId,
    );

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
    match.envidoResolved = false;
    match.trucoOpened = false;
    match.suspendedCanto = null;
    match.pendingEnvidoSinging = null;
    match.lastHandScoredAt = null;
    match.lastHandWinnerTeamSide = null;
    match.turnDeadlineAt = null;
    match.reconnectDeadlineAt = null;
    match.activeBongBet = null;
    room.phase = 'action_turn';
    this.setStatus(room, `Mano ${match.handNumber} en juego.`);
    this.pushEvent(
      room,
      `Nueva mano repartida. Arranca ${room.seats.find((seat) => seat.id === nextDealerSeatId)?.displayName ?? 'la mano'}.`,
    );
    this.scheduleTurnTimeout(room.code);
    this.persistAction(room, 'hand_prepared', {
      handNumber: match.handNumber,
      dealerSeatId: nextDealerSeatId,
    });
  }

  private settleBongBet(room: MutableRoom, handWinnerTeam: TeamSide): void {
    const match = room.match;
    if (!match?.activeBongBet || !room.allowBongs) return;

    const { betterSeatId, targetSeatId } = match.activeBongBet;
    match.activeBongBet = null;

    if (!(betterSeatId in match.bongBalance))
      match.bongBalance[betterSeatId] = 0;
    if (!(targetSeatId in match.bongBalance))
      match.bongBalance[targetSeatId] = 0;

    const betterTeam = room.seats.find((s) => s.id === betterSeatId)?.teamSide;
    const betterName =
      room.seats.find((s) => s.id === betterSeatId)?.displayName ?? 'Jugador';
    const targetName =
      room.seats.find((s) => s.id === targetSeatId)?.displayName ?? 'Jugador';

    if (betterTeam === handWinnerTeam) {
      match.bongBalance[betterSeatId]++;
      match.bongBalance[targetSeatId]--;
      this.pushEvent(
        room,
        `BONG: ${betterName} ganó un BONG. ${targetName} le debe uno.`,
      );
    } else {
      match.bongBalance[targetSeatId]++;
      match.bongBalance[betterSeatId]--;
      this.pushEvent(
        room,
        `BONG: ${targetName} recuperó un BONG de ${betterName}.`,
      );
    }
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
        suit: entry.suit as NormalCardSuit,
        label: entry.label,
      }));
    const playedSignatures = new Set(
      (room.match?.tableCards ?? []).map((play) =>
        this.getCardSignature(play.card.rank, play.card.suit as NormalCardSuit),
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

  private canInterruptPendingTrucoWithEnvido(
    room: MutableRoom,
    actorSeatId: string | null,
    cantoType: MutablePendingCanto['cantoType'],
  ) {
    if (!room.match || this.isTrucoCanto(cantoType)) {
      return false;
    }

    const pending = room.match.pendingCanto;

    return (
      room.phase === 'response_pending' &&
      pending !== null &&
      this.isTrucoCanto(pending.cantoType) &&
      pending.targetSeatId === actorSeatId &&
      room.match.trickNumber === 1 &&
      room.match.tableCards.length === 0 &&
      !room.match.envidoResolved
    );
  }

  private canRaiseTruco(
    room: MutableRoom,
    actorSeatId: string | null,
    newCantoType: MutablePendingCanto['cantoType'],
  ) {
    if (!room.match || !this.isTrucoCanto(newCantoType)) {
      return false;
    }

    const pending = room.match.pendingCanto;

    if (
      room.phase !== 'response_pending' ||
      !pending ||
      !this.isTrucoCanto(pending.cantoType)
    ) {
      return false;
    }

    // Only the target of the pending canto can raise
    if (pending.targetSeatId !== actorSeatId) {
      return false;
    }

    // New call must be strictly higher in the ladder
    const ladder: MutablePendingCanto['cantoType'][] = [
      'truco',
      'retruco',
      'vale_cuatro',
    ];
    const oldIdx = ladder.indexOf(pending.cantoType);
    const newIdx = ladder.indexOf(newCantoType);

    return newIdx === oldIdx + 1;
  }

  private getPendingCantoCallChain(pending: MutablePendingCanto) {
    return pending.callChain.length > 0
      ? [...pending.callChain]
      : [pending.cantoType];
  }

  private getAllowedNextEnvidoCalls(
    callChain: Array<'envido' | 'real_envido' | 'falta_envido'>,
  ) {
    const lastCall = callChain[callChain.length - 1];
    const envidoCount = callChain.filter((call) => call === 'envido').length;

    if (lastCall === 'falta_envido') {
      return [] as Array<'envido' | 'real_envido' | 'falta_envido'>;
    }

    if (lastCall === 'real_envido') {
      return ['falta_envido'] as Array<
        'envido' | 'real_envido' | 'falta_envido'
      >;
    }

    const nextCalls: Array<'envido' | 'real_envido' | 'falta_envido'> = [];

    if (envidoCount < 2) {
      nextCalls.push('envido');
    }

    nextCalls.push('real_envido', 'falta_envido');

    return nextCalls;
  }

  private canRaiseEnvido(
    room: MutableRoom,
    actorSeatId: string | null,
    newCantoType: MutablePendingCanto['cantoType'],
  ) {
    if (
      !room.match ||
      this.isTrucoCanto(newCantoType) ||
      room.phase !== 'response_pending'
    ) {
      return false;
    }

    const pending = room.match.pendingCanto;

    if (!pending || this.isTrucoCanto(pending.cantoType)) {
      return false;
    }

    if (pending.targetSeatId !== actorSeatId) {
      return false;
    }

    return this.getAllowedNextEnvidoCalls(
      this.getPendingCantoCallChain(pending) as Array<
        'envido' | 'real_envido' | 'falta_envido'
      >,
    ).includes(newCantoType);
  }

  private validateCantoOpen(
    room: MutableRoom,
    cantoType: MutablePendingCanto['cantoType'],
    actorSeatId?: string | null,
  ) {
    if (!room.match) {
      return;
    }

    if (!this.isTrucoCanto(cantoType)) {
      // Envido rules: only callable in the first trick, before truco is called/accepted, and only once per hand.
      if (room.match.trickNumber > 1) {
        throw new BadRequestException(
          'El envido solo se puede cantar en la primera vuelta.',
        );
      }

      if (
        room.match.trucoOpened &&
        !this.canInterruptPendingTrucoWithEnvido(
          room,
          actorSeatId ?? null,
          cantoType,
        )
      ) {
        throw new BadRequestException(
          'No se puede cantar envido después de que se cantó el truco.',
        );
      }

      if (room.match.envidoResolved) {
        throw new BadRequestException('El envido ya fue cantado en esta mano.');
      }

      return;
    }

    const targetPoints = this.getAcceptedTrucoPoints(cantoType);

    if (room.match.currentHandPoints >= targetPoints) {
      throw new BadRequestException(
        `${cantoType} is already active or surpassed for this hand.`,
      );
    }

    if (cantoType === 'retruco' && room.match.currentHandPoints < 2) {
      throw new BadRequestException(
        'retruco can only be called after truco is accepted.',
      );
    }

    if (cantoType === 'vale_cuatro' && room.match.currentHandPoints < 3) {
      throw new BadRequestException(
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
      return room.phase === 'lobby' ? 'Esperando en el lobby.' : null;
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
      if (match.pendingCanto?.targetSeatId) {
        return match.pendingCanto.targetSeatId;
      }
      // No explicit target: find the first occupied opposing-team seat
      const callerSeat = room.seats.find(
        (s) => s.id === match.pendingCanto?.actorSeatId,
      );
      const responder = room.seats.find(
        (s) =>
          s.displayName &&
          s.teamSide !== null &&
          s.teamSide !== callerSeat?.teamSide,
      );
      return responder?.id ?? null;
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
      throw new BadRequestException(`Missing or invalid ${fieldName}.`);
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
      throw new BadRequestException(`Invalid ${fieldName}.`);
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

    throw new BadRequestException('Missing or invalid cantoType.');
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

    throw new BadRequestException('Missing or invalid response.');
  }

  private requireSummarySource(
    value: unknown,
  ): 'manual' | 'match_end' | 'reconnect' {
    if (value === 'match_end' || value === 'reconnect') {
      return value;
    }

    return 'manual';
  }

  private requireNumberField(
    payload: Record<string, unknown>,
    fieldName: string,
  ): number {
    const value = payload[fieldName];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`Missing or invalid ${fieldName}.`);
    }

    return value;
  }

  private requireCardSuit(value: unknown): NormalCardSuit {
    if (
      value === 'espada' ||
      value === 'basto' ||
      value === 'oro' ||
      value === 'copa'
    ) {
      return value;
    }

    throw new BadRequestException('Missing or invalid suit.');
  }

  private getDeclinedCantoPoints(
    cantoType: MutablePendingCanto['cantoType'],
    room?: MutableRoom,
    callChain?: MutablePendingCanto['callChain'],
  ) {
    if (
      !this.isTrucoCanto(cantoType) &&
      room &&
      callChain &&
      callChain.length > 0
    ) {
      return Math.max(
        1,
        this.getAcceptedEnvidoPointsForChain(
          room,
          callChain.slice(0, -1) as Array<
            'envido' | 'real_envido' | 'falta_envido'
          >,
        ),
      );
    }

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

  private getAcceptedEnvidoPointsForChain(
    room: MutableRoom,
    callChain: Array<'envido' | 'real_envido' | 'falta_envido'>,
  ) {
    return callChain.reduce(
      (total, call) => total + this.getAcceptedEnvidoPoints(room, call),
      0,
    );
  }

  private getAcceptedEnvidoScoreDelta(
    room: MutableRoom,
    callChain: Array<'envido' | 'real_envido' | 'falta_envido'>,
  ): TeamScoreView {
    const awardedTeam = this.getEnvidoWinningTeam(room);
    const points = this.getAcceptedEnvidoPointsForChain(room, callChain);

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
      return this.getManoTeamSide(room) ?? 'A';
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

  private getSeatEnvidoScoreWithOverride(
    hand: MutableCard[],
    override?: { cardId: string; rank: number; suit: NormalCardSuit } | null,
  ) {
    const effectiveHand = hand.map((card) => {
      if (override && card.isWildcard && card.id === override.cardId) {
        return { ...card, rank: override.rank, suit: override.suit };
      }
      return card;
    });
    return this.getSeatEnvidoScore(effectiveHand);
  }

  private buildSingingOrder(
    room: MutableRoom,
    callerSeatId: string,
    quieroSeatId: string,
  ): string[] {
    const callerTeam =
      room.seats.find((s) => s.id === callerSeatId)?.teamSide ?? null;
    const quieroTeam =
      room.seats.find((s) => s.id === quieroSeatId)?.teamSide ?? null;

    const occupied = this.getOccupiedSeats(room);

    const callingTeam = occupied.filter(
      (s) => s.teamSide === callerTeam && s.id !== callerSeatId,
    );
    const acceptingTeam = occupied.filter(
      (s) => s.teamSide === quieroTeam && s.id !== quieroSeatId,
    );

    // Caller's team sings first (caller first, then partner).
    // Accepting team sings last (quiero seat last — they have the advantage).
    return [
      callerSeatId,
      ...callingTeam.map((s) => s.id),
      ...acceptingTeam.map((s) => s.id),
      quieroSeatId,
    ];
  }

  private buildEnvidoSinging(
    room: MutableRoom,
    pending: MutablePendingCanto,
    quieroSeat: MutableSeat,
  ): MutableEnvidoSinging {
    const callerSeatId = pending.actorSeatId;
    const callerTeamSide =
      room.seats.find((s) => s.id === callerSeatId)?.teamSide ?? 'A';
    const cantoType = pending.cantoType as MutableEnvidoSinging['cantoType'];
    const callChain = this.getPendingCantoCallChain(pending) as Array<
      'envido' | 'real_envido' | 'falta_envido'
    >;

    const singingOrder = this.buildSingingOrder(
      room,
      callerSeatId,
      quieroSeat.id,
    );

    // Find seats with uncommitted dimadong cards
    const pendingWildcardCommits: MutableEnvidoWildcardCommit[] = [];
    for (const seatId of singingOrder) {
      const hand = room.match?.handsBySeatId[seatId] ?? [];
      const wildcardCard = hand.find((c) => c.isWildcard);
      if (wildcardCard) {
        pendingWildcardCommits.push({
          seatId,
          wildcardCardId: wildcardCard.id,
          requestedAt: new Date().toISOString(),
          commitDeadlineAt: null,
        });
      }
    }

    return {
      callerSeatId,
      callerTeamSide,
      quieroSeatId: quieroSeat.id,
      cantoType,
      callChain,
      singingOrder,
      declarations: [],
      pendingWildcardCommits,
      wildcardOverridesBySeatId: {},
    };
  }

  computeEnvidoDeclarations(
    room: MutableRoom,
    singing: MutableEnvidoSinging,
  ): MutableEnvidoDeclaration[] {
    const declarations: MutableEnvidoDeclaration[] = [];
    let callingTeamBest = 0;
    const manoTeamSide = this.getManoTeamSide(room) ?? singing.callerTeamSide;

    for (const seatId of singing.singingOrder) {
      const seat = room.seats.find((s) => s.id === seatId);
      if (!seat?.teamSide || !room.match) continue;

      const hand = room.match.handsBySeatId[seatId] ?? [];
      const override = singing.wildcardOverridesBySeatId[seatId] ?? null;
      const score = this.getSeatEnvidoScoreWithOverride(hand, override);
      const hasDimadong = hand.some((c) => c.isWildcard);
      const isCallingTeam = seat.teamSide === singing.callerTeamSide;

      let action: 'declared' | 'son_buenas';
      if (isCallingTeam) {
        action = 'declared';
        callingTeamBest = Math.max(callingTeamBest, score);
      } else {
        // Accepting team: declare only if they can beat the calling team best.
        // On tie, mano wins, so accepting team needs
        // strictly greater score to take the points.
        action =
          score > callingTeamBest ||
          (score === callingTeamBest && seat.teamSide === manoTeamSide)
            ? 'declared'
            : 'son_buenas';
      }

      declarations.push({
        seatId,
        teamSide: seat.teamSide,
        score,
        action,
        hasDimadong,
      });
    }

    return declarations;
  }

  applyEnvidoDeclarations(
    room: MutableRoom,
    singing: MutableEnvidoSinging,
    declarations: MutableEnvidoDeclaration[],
  ): TeamScoreView {
    singing.declarations = declarations;

    // Winner = seat with highest declared score; on tie, mano wins.
    let winnerTeam: TeamSide =
      this.getManoTeamSide(room) ?? singing.callerTeamSide;
    let best = -1;

    for (const d of declarations) {
      if (d.action === 'declared' && d.score > best) {
        best = d.score;
        winnerTeam = d.teamSide;
      } else if (d.action === 'declared' && d.score === best) {
        // tie → mano (caller) wins
        winnerTeam = this.getManoTeamSide(room) ?? singing.callerTeamSide;
      }
    }

    const points = this.getAcceptedEnvidoPointsForChain(
      room,
      singing.callChain,
    );

    const scoreDelta: TeamScoreView = {
      A: winnerTeam === 'A' ? points : 0,
      B: winnerTeam === 'B' ? points : 0,
    };

    room.match!.teamScores = {
      A: room.match!.teamScores.A + scoreDelta.A,
      B: room.match!.teamScores.B + scoreDelta.B,
    };

    // Add per-player events in singing order
    for (const d of declarations) {
      const seat = room.seats.find((s) => s.id === d.seatId);
      const name = seat?.displayName ?? 'Jugador';
      if (d.action === 'son_buenas') {
        this.pushEvent(room, `${name}: son buenas.`);
      } else {
        this.pushEvent(room, `${name}: ${d.score} puntos de envido.`);
      }
    }

    return scoreDelta;
  }

  buildEnvidoSingingState(room: MutableRoom): EnvidoSingingState | null {
    const singing = room.match?.pendingEnvidoSinging ?? null;
    if (!singing) return null;

    return {
      cantoType: singing.cantoType,
      callChain: [...singing.callChain],
      callerSeatId: singing.callerSeatId,
      quieroSeatId: singing.quieroSeatId,
      callerTeamSide: singing.callerTeamSide,
      singingOrder: singing.singingOrder,
      declarations: singing.declarations.map(
        (d): EnvidoSeatDeclaration => ({
          seatId: d.seatId,
          teamSide: d.teamSide,
          score: d.score,
          action: d.action,
          hasDimadong: d.hasDimadong,
        }),
      ),
      pendingWildcardCommits: singing.pendingWildcardCommits.map(
        (c): EnvidoWildcardCommitView => ({
          seatId: c.seatId,
          wildcardCardId: c.wildcardCardId,
          requestedAt: c.requestedAt,
          commitDeadlineAt: c.commitDeadlineAt,
        }),
      ),
    };
  }

  commitWildcardForEnvido(
    code: string,
    roomSessionToken: string,
    wildcardCardId: string,
    rank: number,
    suit: NormalCardSuit,
  ): {
    snapshot: RoomSnapshot;
    lifecycle: RoomLifecycleState;
    declarations: MutableEnvidoDeclaration[] | null;
    scoreDelta: TeamScoreView;
    matchEnded: boolean;
    envidoSinging: MutableEnvidoSinging;
  } {
    const { room, actorSeat } = this.getAuthorizedSeat(code, roomSessionToken);

    if (!room.match?.pendingEnvidoSinging) {
      throw new BadRequestException(
        'No hay una fase de canto de envido activa.',
      );
    }

    const singing = room.match.pendingEnvidoSinging;
    const pending = singing.pendingWildcardCommits.find(
      (c) => c.seatId === actorSeat.id,
    );

    if (!pending) {
      throw new BadRequestException(
        'Este asiento no tiene un dimadong pendiente de comprometer.',
      );
    }

    // Validate the wildcard card is in the seat's hand
    const hand = room.match.handsBySeatId[actorSeat.id] ?? [];
    const wildcardCard = hand.find(
      (c) => c.id === wildcardCardId && c.isWildcard,
    );

    if (!wildcardCard) {
      throw new BadRequestException('Carta dimadong no encontrada en la mano.');
    }

    // Store the override for envido calculation
    singing.wildcardOverridesBySeatId[actorSeat.id] = {
      cardId: wildcardCardId,
      rank,
      suit,
    };

    // Lock the wildcard card so it must be played as this value for truco too
    wildcardCard.envidoLock = { rank, suit, label: `${rank} de ${suit}` };

    // Remove from pending
    singing.pendingWildcardCommits = singing.pendingWildcardCommits.filter(
      (c) => c.seatId !== actorSeat.id,
    );

    let declarations: MutableEnvidoDeclaration[] | null = null;
    let scoreDelta: TeamScoreView = { A: 0, B: 0 };
    let matchEnded = false;

    if (singing.pendingWildcardCommits.length === 0) {
      // All committed — compute and apply declarations
      declarations = this.computeEnvidoDeclarations(room, singing);
      scoreDelta = this.applyEnvidoDeclarations(room, singing, declarations);
      room.match.pendingEnvidoSinging = null;

      const winningTeam = this.getWinningTeamForScore(
        room.match.teamScores,
        room.targetScore,
      );

      if (winningTeam) {
        matchEnded = true;
        room.phase = 'match_end';
        room.match.currentTurnSeatId = null;
        room.match.turnDeadlineAt = null;
        room.match.suspendedCanto = null;
        room.match.summary = {
          winnerTeamSide: winningTeam,
          finalScore: { ...room.match.teamScores },
        };
        this.clearTurnTimeout(room.code);
        this.setStatus(room, `El Equipo ${winningTeam} ganó la partida.`);
        this.persistMatchFinished(room, winningTeam);
      } else {
        if (room.match.suspendedCanto) {
          const resumed = room.match.suspendedCanto;
          room.phase = 'response_pending';
          room.match.pendingCanto = {
            ...resumed,
            responseDeadlineAt: new Date(Date.now() + 12_000).toISOString(),
          };
          room.match.suspendedCanto = null;
          room.match.turnDeadlineAt = null;
          this.setStatus(
            room,
            `Se resolvió el ${singing.cantoType}. Queda pendiente la respuesta al ${resumed.cantoType}.`,
          );
          this.scheduleCantoTimeout(room.code);
          this.persistSnapshot(room);
          const snapshot = this.buildSnapshot(room);
          const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);

          return {
            snapshot,
            lifecycle,
            declarations,
            scoreDelta,
            matchEnded,
            envidoSinging: singing,
          };
        }

        room.phase = 'action_turn';
        room.match.turnDeadlineAt = null;
        this.setStatus(room, 'Envido cantado. La mano continúa.');
        this.scheduleTurnTimeout(room.code);
      }
    } else {
      // Still waiting for more commits — stay in envido_wildcard_commit
      room.phase = 'envido_wildcard_commit';
    }

    this.persistSnapshot(room);
    const snapshot = this.buildSnapshot(room);
    const lifecycle = this.getRoomLifecycleState(room.code, actorSeat.id);

    return {
      snapshot,
      lifecycle,
      declarations,
      scoreDelta,
      matchEnded,
      envidoSinging: singing,
    };
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
      throw new BadRequestException('Selected wildcard value is not legal.');
    }

    return selectedChoice;
  }

  private getCardSignature(rank: number, suit: NormalCardSuit) {
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
    const manoTeam = this.getTeamSideForSeat(room, match.dealerSeatId) ?? 'A';
    const [firstTrick, secondTrick, thirdTrick] = match.trickResults;
    const firstWinner = firstTrick?.winnerTeamSide ?? null;
    const secondWinner = secondTrick?.winnerTeamSide ?? null;
    const thirdWinner = thirdTrick?.winnerTeamSide ?? null;

    if (trickNumber === 1) {
      return null;
    }

    if (trickNumber === 2) {
      if (firstWinner === null && secondWinner === null) {
        return manoTeam;
      }

      if (firstWinner === null) {
        return secondWinner;
      }

      if (secondWinner === null || secondWinner === firstWinner) {
        return firstWinner;
      }

      return null;
    }

    if (firstWinner === null) {
      if (secondWinner === null) {
        return manoTeam;
      }

      return secondWinner;
    }

    if (secondWinner === null || secondWinner === firstWinner) {
      return firstWinner;
    }

    if (thirdWinner === null) {
      return firstWinner;
    }

    return thirdWinner;
  }

  private getTeamSideForSeat(room: MutableRoom, seatId: string | null) {
    if (!seatId) {
      return null;
    }

    return room.seats.find((seat) => seat.id === seatId)?.teamSide ?? null;
  }

  private getManoTeamSide(room: MutableRoom) {
    return this.getTeamSideForSeat(room, room.match?.dealerSeatId ?? null);
  }

  private getHandStarterSeatId(room: MutableRoom, match: MutableMatchState) {
    return match.dealerSeatId ?? this.getOccupiedSeats(room)[0]?.id ?? null;
  }

  private getNextOccupiedSeatId(room: MutableRoom, fromSeatId: string | null) {
    const occupiedSeats = this.getOccupiedSeats(room);

    if (occupiedSeats.length === 0) {
      return null;
    }

    if (!fromSeatId) {
      return occupiedSeats[0]?.id ?? null;
    }

    const currentIndex = occupiedSeats.findIndex(
      (seat) => seat.id === fromSeatId,
    );

    if (currentIndex === -1) {
      return occupiedSeats[0]?.id ?? null;
    }

    return occupiedSeats[(currentIndex + 1) % occupiedSeats.length]?.id ?? null;
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

  freeSeat(
    roomCode: string,
    actorToken: string,
    targetSeatId: string,
  ): RoomSnapshot {
    const room = this.getRequiredRoom(roomCode);
    const actor = room.seats.find((s) => s.roomSessionToken === actorToken);

    if (!actor?.isHost) {
      throw new BadRequestException('Solo el host puede liberar un asiento.');
    }

    const seat = room.seats.find((s) => s.id === targetSeatId);

    if (!seat) {
      throw new BadRequestException('Asiento no encontrado.');
    }

    if (seat.status !== 'disconnected') {
      throw new BadRequestException('El asiento no está desconectado.');
    }

    if (seat.id === actor.id) {
      throw new BadRequestException('No podés liberar tu propio asiento.');
    }

    if (room.match && room.phase !== 'lobby' && room.phase !== 'ready_check') {
      throw new BadRequestException(
        'No se puede liberar un asiento durante una mano activa.',
      );
    }

    const previousDisplayName = seat.displayName;

    if (seat.roomSessionToken) {
      this.roomCodeByToken.delete(seat.roomSessionToken);
    }

    seat.status = 'open';
    seat.displayName = null;
    seat.avatarId = null;
    seat.roomSessionToken = null;
    seat.seatClaimToken = null;
    seat.isReady = false;
    seat.reconnectToken = null;
    seat.socketId = null;
    seat.persistedOccupancyId = null;
    seat.persistedConnectionId = null;

    this.pushEvent(
      room,
      `${actor.displayName ?? 'El host'} liberó el asiento de ${previousDisplayName ?? 'jugador desconectado'}.`,
    );
    this.persistSnapshot(room);

    return this.buildSnapshot(room);
  }

  private attachSeat(
    seat: MutableSeat,
    roomCode: string,
    roomId: string,
    displayName: string,
    avatarId: AvatarId | null,
  ): RoomSession {
    const roomSessionToken = this.createToken();
    const seatClaimToken = this.createToken();

    seat.displayName = displayName;
    seat.avatarId = avatarId;
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
      avatarId,
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
            pendingCanto: room.match.pendingCanto,
            suspendedCanto: room.match.suspendedCanto,
            pendingWildcardSelection: room.match.pendingWildcardSelection,
            pendingEnvidoSinging: room.match.pendingEnvidoSinging,
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
    const suits: NormalCardSuit[] = ['espada', 'basto', 'oro', 'copa'];
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
        suit: 'comodin',
        rank: 0,
        label: 'DIMADONG',
        isWildcard: true,
      });
    }

    return cards;
  }

  private getCardStrength(card: MutableCard) {
    if (card.isWildcard) {
      return 99;
    }

    const trucoStrength = `${card.rank}-${card.suit}`;
    const ranking: Record<string, number> = {
      '1-espada': 100,
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

    room.match.turnDeadlineAt = null;
    return;

    /*

    const timeoutMs = this.resolveTimeoutDelay(
      options?.preserveDeadline ? room.match.turnDeadlineAt : null,
      25_000,
    );
    if (!options?.preserveDeadline || !room.match.turnDeadlineAt) {
      room.match.turnDeadlineAt = new Date(
        Date.now() + timeoutMs,
      ).toISOString();
    }
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
        `Tiempo agotado. Jugando automáticamente por ${latestRoom.seats.find((seat) => seat.id === currentSeatId)?.displayName ?? 'el jugador'}.`,
      );
      this.playCard({
        roomCode,
        roomSessionToken: token,
        cardId,
      });
    }, timeoutMs);
    timeout.unref?.();
    this.turnTimeouts.set(roomCode, timeout);
    */
  }

  private clearTurnTimeout(roomCode: string) {
    const existing = this.turnTimeouts.get(roomCode);

    if (existing) {
      clearTimeout(existing);
      this.turnTimeouts.delete(roomCode);
    }
  }

  private scheduleReconnectTimeout(
    roomCode: string,
    options?: { preserveDeadline?: boolean },
  ) {
    this.clearReconnectTimeout(roomCode);
    const room = this.roomsByCode.get(roomCode);

    if (!room?.match || room.phase !== 'reconnect_hold') {
      return;
    }

    const timeoutMs = this.resolveTimeoutDelay(
      options?.preserveDeadline ? room.match.reconnectDeadlineAt : null,
      RoomStoreService.RECONNECT_GRACE_MS,
    );

    const timeout = setTimeout(() => {
      const latestRoom = this.roomsByCode.get(roomCode);

      if (!latestRoom?.match || latestRoom.phase !== 'reconnect_hold') {
        return;
      }

      latestRoom.phase = 'action_turn';
      latestRoom.match.reconnectDeadlineAt = null;
      this.pushEvent(
        latestRoom,
        'Tiempo de reconexión agotado. Reanudando partida.',
      );
      this.setStatus(
        latestRoom,
        `Le toca a ${latestRoom.seats.find((seat) => seat.id === latestRoom.match?.currentTurnSeatId)?.displayName ?? 'jugador actual'}.`,
      );
      this.scheduleTurnTimeout(roomCode);
    }, timeoutMs);
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

  private scheduleCantoTimeout(
    roomCode: string,
    options?: { preserveDeadline?: boolean },
  ) {
    this.clearCantoTimeout(roomCode);
    const room = this.roomsByCode.get(roomCode);

    if (!room?.match?.pendingCanto || room.phase !== 'response_pending') {
      return;
    }

    const timeoutMs = this.resolveTimeoutDelay(
      options?.preserveDeadline
        ? room.match.pendingCanto.responseDeadlineAt
        : null,
      60_000,
    );

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
      const callerTeamSide = latestRoom.seats.find(
        (seat) => seat.id === pending.actorSeatId,
      )?.teamSide;
      const token = (
        targetSeatId
          ? latestRoom.seats.find((seat) => seat.id === targetSeatId)
          : latestRoom.seats.find(
              (seat) =>
                seat.teamSide !== callerTeamSide && seat.roomSessionToken,
            )
      )?.roomSessionToken;

      if (!token) {
        return;
      }

      this.pushEvent(
        latestRoom,
        `Tiempo agotado. ${pending.cantoType} resuelto como no quiero.`,
      );
      try {
        this.resolveCanto(roomCode, token, 'no_quiero');
      } catch (err) {
        // Auto-resolve failed (e.g. game state changed before timeout fired); log and continue.
        console.error('[cantoTimeout] resolveCanto failed:', err);
      }
    }, timeoutMs);

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

  private scheduleWildcardTimeout(
    roomCode: string,
    options?: { preserveDeadline?: boolean },
  ) {
    this.clearWildcardTimeout(roomCode);
    const room = this.roomsByCode.get(roomCode);

    if (
      !room?.match?.pendingWildcardSelection ||
      room.phase !== 'wildcard_selection'
    ) {
      return;
    }

    const timeoutMs = this.resolveTimeoutDelay(
      options?.preserveDeadline
        ? room.match.pendingWildcardSelection.selectionDeadlineAt
        : null,
      15_000,
    );

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
        'Tiempo agotado. DIMADONG seleccionado automáticamente como 4 de copa.',
      );
      this.selectWildcard(
        roomCode,
        token,
        pending.cardId,
        pending.availableLabels.includes('4 de copa')
          ? '4 de copa'
          : (pending.availableLabels[0] ?? '4 de copa'),
      );
    }, timeoutMs);

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

  private resolveTimeoutDelay(
    deadlineAt: string | null | undefined,
    fallbackMs: number,
  ): number {
    if (!deadlineAt) {
      return fallbackMs;
    }

    const deadlineMs = Date.parse(deadlineAt);
    if (Number.isNaN(deadlineMs)) {
      return fallbackMs;
    }

    return Math.max(0, deadlineMs - Date.now());
  }

  private restoreTransientTimers(roomCode: string) {
    const room = this.roomsByCode.get(roomCode);
    if (!room?.match) {
      return;
    }

    this.clearTurnTimeout(roomCode);
    this.clearReconnectTimeout(roomCode);
    this.clearCantoTimeout(roomCode);
    this.clearWildcardTimeout(roomCode);

    if (room.phase === 'action_turn' && room.match.currentTurnSeatId) {
      this.scheduleTurnTimeout(roomCode);
      return;
    }

    if (room.phase === 'reconnect_hold') {
      this.scheduleReconnectTimeout(roomCode, { preserveDeadline: true });
      return;
    }

    if (room.phase === 'response_pending' && room.match.pendingCanto) {
      this.scheduleCantoTimeout(roomCode, { preserveDeadline: true });
      return;
    }

    if (
      room.phase === 'wildcard_selection' &&
      room.match.pendingWildcardSelection
    ) {
      this.scheduleWildcardTimeout(roomCode, { preserveDeadline: true });
    }
  }
}
