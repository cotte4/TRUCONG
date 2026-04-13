export type MatchPhase =
  | 'lobby'
  | 'ready_check'
  | 'dealing'
  | 'action_turn'
  | 'canto_pending'
  | 'response_pending'
  | 'envido_wildcard_commit'
  | 'envido_singing'
  | 'wildcard_selection'
  | 'trick_resolution'
  | 'hand_scoring'
  | 'reconnect_hold'
  | 'match_end'
  | 'post_match_summary';

export type TeamSide = 'A' | 'B';
export type SeatStatus = 'open' | 'occupied' | 'disconnected' | 'replaced';
export type NormalCardSuit = 'espada' | 'basto' | 'oro' | 'copa';
export type CardSuit = NormalCardSuit | 'comodin';
export type CantoType =
  | 'envido'
  | 'real_envido'
  | 'falta_envido'
  | 'truco'
  | 'retruco'
  | 'vale_cuatro';
export const AVATAR_IDS = [
  'alien-neon-ace',
  'alien-beanie',
  'alien-mask',
  'alien-dreads',
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export interface CardView {
  id: string;
  suit: CardSuit;
  rank: number;
  label: string;
  isWildcard: boolean;
}

export interface TablePlayView {
  seatId: string;
  displayName?: string | null;
  card: CardView;
}

export interface TeamScoreView {
  A: number;
  B: number;
}

export interface TrickResultView {
  trickNumber: number;
  winnerSeatId: string | null;
  winnerTeamSide: TeamSide | null;
  winningCardLabel: string | null;
}

export interface MatchSummaryView {
  winnerTeamSide: TeamSide;
  finalScore: TeamScoreView;
}

export interface MatchTransitionResultState {
  state: 'idle' | 'resolved';
  resolvedAt: string | null;
  winnerSeatId: string | null;
  winnerTeamSide: TeamSide | null;
  winningCardLabel: string | null;
}

export interface MatchLifecycleSummaryState {
  state: 'idle' | 'resolved';
  resolvedAt: string | null;
  finalScore: TeamScoreView | null;
  winnerTeamSide: TeamSide | null;
  reason: string | null;
}

export interface PendingCantoState {
  cantoType: CantoType;
  callChain: CantoType[];
  actorSeatId: string;
  targetSeatId: string | null;
  openedAt: string;
  responseDeadlineAt: string | null;
  hasBong: boolean;
}

export interface MatchTransitionState {
  phaseDetail: string | null;
  pendingCanto: PendingCantoState | null;
  activeActionSeatId: string | null;
  latestTrickResult: TrickResultView | null;
  latestTrickResolvedAt: string | null;
  trickResult: MatchTransitionResultState;
  handComplete: boolean;
  lastHandScoredAt: string | null;
  lastHandWinnerTeamSide: TeamSide | null;
  handSummary: MatchLifecycleSummaryState;
  matchComplete: boolean;
  winnerTeamSide: TeamSide | null;
  matchSummary: MatchLifecycleSummaryState;
}

export interface MatchView {
  handNumber: number;
  trickNumber: number;
  currentHandPoints: number;
  envidoResolved: boolean;
  trucoOpened: boolean;
  currentTurnSeatId: string | null;
  dealerSeatId: string | null;
  yourHand: CardView[];
  tableCards: TablePlayView[];
  yourTeamSide: TeamSide | null;
  score: TeamScoreView;
  trickResults: TrickResultView[];
  recentEvents: string[];
  statusText: string;
  summary: MatchSummaryView | null;
  turnDeadlineAt: string | null;
  reconnectDeadlineAt: string | null;
}

export interface RoomSeatSnapshot {
  id: string;
  seatIndex: number;
  status: SeatStatus;
  teamSide: TeamSide | null;
  displayName: string | null;
  avatarId: AvatarId | null;
  isHost: boolean;
  isReady: boolean;
  handCount: number;
  bongBalance: number;
}

export interface RoomSnapshot {
  roomId: string;
  code: string;
  phase: MatchPhase;
  hostSeatId: string | null;
  maxPlayers: number;
  targetScore: number;
  allowBongs: boolean;
  allow3v3: boolean;
  seats: RoomSeatSnapshot[];
  score: TeamScoreView;
  recentEvents: string[];
  statusText: string;
  winnerTeamSide: TeamSide | null;
  turnDeadlineAt: string | null;
  reconnectDeadlineAt: string | null;
  stateVersion: number;
}

export interface RoomSession {
  roomId: string;
  roomCode: string;
  seatId: string;
  displayName: string;
  avatarId: AvatarId | null;
  roomSessionToken: string;
  seatClaimToken: string;
}

export interface SessionResumePayload {
  roomCode: string;
  roomSessionToken: string;
}

export interface SocketAckResult<TData = Record<string, unknown>> {
  ok: boolean;
  roomCode: string;
  message?: string;
  data?: TData;
}

export interface CreateRoomRequest {
  displayName: string;
  avatarId?: AvatarId;
  maxPlayers?: 2 | 4 | 6;
  targetScore?: 11 | 15 | 30;
  allowBongs?: boolean;
}

export interface JoinRoomRequest {
  displayName: string;
  avatarId?: AvatarId;
  preferredSeatIndex?: number;
}

export interface RoomEntryResponse {
  snapshot: RoomSnapshot;
  session: RoomSession;
  matchView?: MatchView | null;
  state?: MatchProgressState | null;
  transition?: MatchTransitionState | null;
  wildcardSelection?: DetailedWildcardSelectionState | null;
  envidoSinging?: EnvidoSingingState | null;
}

export interface ResumeRoomResponse {
  snapshot: RoomSnapshot;
  session: RoomSession | null;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  envidoSinging: EnvidoSingingState | null;
}

export interface LobbyActionPayload {
  roomCode: string;
  roomSessionToken: string;
  clientOffset?: string;
}

export interface RoomJoinPayload extends SessionResumePayload {}

export interface LobbyTeamPayload extends LobbyActionPayload {
  targetSeatId: string;
  teamSide: TeamSide;
}

export interface LobbyActionResponse {
  ok: boolean;
  snapshot?: RoomSnapshot;
  message?: string;
}

export interface SessionResumeResult {
  snapshot: RoomSnapshot;
  session: RoomSession | null;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  envidoSinging: EnvidoSingingState | null;
  recoveredAt: string;
}

export interface SessionResumeAck extends SocketAckResult<SessionResumeResult> {
  session: RoomSession | null;
}

export interface ActionSubmitResult {
  clientActionId: string;
  actionType: string;
  accepted: boolean;
  queued: boolean;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  envidoSinging: EnvidoSingingState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface ActionSubmitAck extends SocketAckResult<ActionSubmitResult> {
  actionType: string;
  clientActionId: string;
  accepted: boolean;
  queued: boolean;
}

export interface ChatSendResult {
  clientMessageId: string;
  accepted: boolean;
  queued: boolean;
  state: MatchProgressState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface ChatSendAck extends SocketAckResult<ChatSendResult> {
  clientMessageId: string;
  accepted: boolean;
  queued: boolean;
}

export interface ReactionSendResult {
  clientReactionId: string;
  targetSeatId: string | null;
  accepted: boolean;
  queued: boolean;
  state: MatchProgressState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface ReactionSendAck extends SocketAckResult<ReactionSendResult> {
  clientReactionId: string;
  targetSeatId: string | null;
  accepted: boolean;
  queued: boolean;
}

export interface RoomDestroyResult {
  roomCode: string;
  roomId: string | null;
  destroyed: boolean;
  destroyedAt: string;
  destroyedBySeatId: string | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface RoomDestroyAck extends SocketAckResult<RoomDestroyResult> {
  roomCode: string;
  roomId: string | null;
  destroyed: boolean;
}

export interface SummaryStartResult {
  roomCode: string;
  clientActionId: string;
  source: 'manual' | 'match_end' | 'reconnect';
  startedAt: string;
  state: MatchProgressState;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  summary: MatchSummaryView;
  transition: MatchTransitionState | null;
}

export interface SummaryStartAck extends SocketAckResult<SummaryStartResult> {
  clientActionId: string;
  source: 'manual' | 'match_end' | 'reconnect';
  startedAt: string;
}

export interface CantoOpenResult {
  clientActionId: string;
  cantoType: CantoType;
  targetSeatId: string | null;
  accepted: boolean;
  queued: boolean;
  openedAt: string;
  responseDeadlineAt: string | null;
  statusText: string;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface CantoOpenAck extends SocketAckResult<CantoOpenResult> {
  clientActionId: string;
  cantoType: CantoType;
  targetSeatId: string | null;
  accepted: boolean;
  queued: boolean;
}

export interface CantoResolveResult {
  clientActionId: string;
  cantoType: CantoType;
  response: CantoResolvePayload['response'];
  targetSeatId: string | null;
  accepted: boolean;
  queued: boolean;
  resolvedAt: string;
  scoreDelta: TeamScoreView;
  statusText: string;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface CantoResolveAck extends SocketAckResult<CantoResolveResult> {
  clientActionId: string;
  cantoType: CantoType;
  response: CantoResolvePayload['response'];
  targetSeatId: string | null;
  accepted: boolean;
  queued: boolean;
}

export interface WildcardSelectResult {
  clientActionId: string;
  cardId: string;
  selectedLabel: string;
  selectedAt: string;
  accepted: boolean;
  queued: boolean;
  selection: DetailedWildcardSelectionState | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface WildcardSelectAck extends SocketAckResult<WildcardSelectResult> {
  clientActionId: string;
  cardId: string;
  accepted: boolean;
  queued: boolean;
}

export interface PlayCardPayload extends LobbyActionPayload {
  cardId: string;
}

export interface ActionSubmitPayload<TPayload = Record<string, unknown>> extends LobbyActionPayload {
  clientActionId: string;
  actionType: string;
  payload: TPayload;
}

export interface ChatSendPayload extends LobbyActionPayload {
  clientMessageId: string;
  message: string;
}

export interface ReactionSendPayload extends LobbyActionPayload {
  clientReactionId: string;
  reaction: string;
  targetSeatId?: string | null;
}

export interface CantoOpenPayload extends LobbyActionPayload {
  clientActionId: string;
  cantoType: CantoType;
  targetSeatId?: string | null;
  note?: string;
  withBong?: boolean;
}

export interface CantoResolvePayload extends LobbyActionPayload {
  clientActionId: string;
  cantoType: CantoType;
  response: 'quiero' | 'no_quiero' | 'accepted' | 'rejected';
  targetSeatId?: string | null;
}

export interface WildcardSelectPayload extends LobbyActionPayload {
  clientActionId: string;
  cardId: string;
  selectedLabel: string;
}

export interface WildcardRequestPayload extends LobbyActionPayload {
  clientActionId: string;
  cardId: string;
}

export interface RoomDestroyPayload extends LobbyActionPayload {
  clientActionId: string;
  reason?: string;
}

export interface SummaryStartPayload extends LobbyActionPayload {
  clientActionId: string;
  source?: 'manual' | 'match_end' | 'reconnect';
}

export interface WildcardSelectionState {
  seatId: string;
  cardId: string;
  selectedLabel: string | null;
  availableLabels: string[];
  requestedAt: string;
  selectionDeadlineAt: string | null;
}

export interface WildcardSelectionChoiceView {
  id: string;
  label: string;
}

export interface DetailedWildcardSelectionState extends WildcardSelectionState {
  phase: MatchPhase;
  isPending: boolean;
  ownerSeatId: string;
  selectedChoiceId: string | null;
  selectedChoiceLabel: string | null;
  availableChoices: WildcardSelectionChoiceView[];
  responseDeadlineAt: string | null;
  fixedForEnvido: boolean;
}

export interface EnvidoSeatDeclaration {
  seatId: string;
  teamSide: TeamSide;
  score: number;
  action: 'declared' | 'son_buenas';
  hasDimadong: boolean;
}

export interface EnvidoWildcardCommitView {
  seatId: string;
  wildcardCardId: string;
  requestedAt: string;
  commitDeadlineAt: string | null;
}

export interface EnvidoSingingState {
  cantoType: string;
  callChain: string[];
  callerSeatId: string;
  quieroSeatId: string;
  callerTeamSide: TeamSide;
  singingOrder: string[];
  declarations: EnvidoSeatDeclaration[];
  pendingWildcardCommits: EnvidoWildcardCommitView[];
}

export interface PicaPicaCompletedPair {
  pairIndex: number;           // 0, 1, or 2
  winnerTeamSide: TeamSide | null; // null = tie
  pointsA: number;
  pointsB: number;
}

export interface PicaPicaProgressState {
  currentPairIndex: number;        // which sub-hand is active: 0, 1, or 2
  totalPairs: number;              // always 3
  activePairSeatIds: [string, string]; // [seatId teamA, seatId teamB]
  completedPairs: PicaPicaCompletedPair[];
}

export interface MatchProgressState {
  phase: MatchPhase;
  handNumber: number;
  trickNumber: number;
  dealerSeatId: string | null;
  currentTurnSeatId: string | null;
  handTrickWins: TeamScoreView;
  tableCards: TablePlayView[];
  resolvedTricks: TrickResultView[];
  score: TeamScoreView;
  statusText: string;
  turnDeadlineAt: string | null;
  reconnectDeadlineAt: string | null;
  summary: MatchSummaryView | null;
  picaPica?: PicaPicaProgressState | null;
}

export interface RoomUpdatedEvent {
  roomCode: string;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  envidoSinging: EnvidoSingingState | null;
  reason?: string;
}

export interface RoomJoinedEvent {
  roomCode: string;
  seatId: string | null;
  socketId: string;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  envidoSinging: EnvidoSingingState | null;
}

export interface EnvidoWildcardCommitRequestedEvent {
  roomCode: string;
  seatId: string;
  wildcardCardId: string;
  availableChoices: WildcardSelectionChoiceView[];
  requestedAt: string;
  commitDeadlineAt: string | null;
  singingState: EnvidoSingingState;
  state: MatchProgressState;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
}

export interface EnvidoSeatDeclaredEvent {
  roomCode: string;
  seatId: string;
  teamSide: TeamSide;
  score: number;
  action: 'declared' | 'son_buenas';
  hasDimadong: boolean;
  callingTeamBest: number;
  singingState: EnvidoSingingState;
  state: MatchProgressState;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
}

export interface SeatUpdatedEvent {
  roomCode: string;
  seat: RoomSeatSnapshot;
}

export interface CantoOpenedEvent {
  roomCode: string;
  seatId: string | null;
  actorSeatId: string | null;
  clientActionId: string | null;
  cantoType: CantoType;
  hasBong: boolean;
  statusText: string;
  openedAt: string;
  responseDeadlineAt: string | null;
  targetSeatId: string | null;
  state: MatchProgressState;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
}

export interface CantoResolvedEvent {
  roomCode: string;
  seatId: string | null;
  actorSeatId: string | null;
  clientActionId: string | null;
  cantoType: CantoType;
  result: 'accepted' | 'rejected' | 'no_quiero' | 'quiero';
  scoreDelta: TeamScoreView;
  statusText: string;
  resolvedAt: string;
  targetSeatId: string | null;
  state: MatchProgressState;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
}

export interface WildcardSelectionRequiredEvent {
  roomCode: string;
  seatId: string;
  cardId: string;
  handNumber: number;
  requestedAt: string;
  selectionDeadlineAt: string | null;
  selection: DetailedWildcardSelectionState;
  state: MatchProgressState;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  reason: string;
}

export interface WildcardSelectedEvent {
  roomCode: string;
  seatId: string;
  cardId: string;
  handNumber: number;
  selectedCard: CardView;
  selectedLabel: string;
  selectedAt: string;
  accepted: boolean;
  selection: DetailedWildcardSelectionState;
  state: MatchProgressState;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
}

export interface WildcardRequestResult {
  clientActionId: string;
  cardId: string;
  requestedAt: string;
  accepted: boolean;
  queued: boolean;
  selection: DetailedWildcardSelectionState | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface WildcardRequestAck extends SocketAckResult<WildcardRequestResult> {
  clientActionId: string;
  cardId: string;
  accepted: boolean;
  queued: boolean;
}

export interface TrickResolvedEvent {
  roomCode: string;
  handNumber: number;
  trickNumber: number;
  dealerSeatId: string | null;
  currentTurnSeatId: string | null;
  handTrickWins: TeamScoreView;
  winnerSeatId: string | null;
  winnerTeamSide: TeamSide | null;
  winningCardLabel: string | null;
  tableCards: TablePlayView[];
  resolvedTricks: TrickResultView[];
  resolvedAt: string;
  nextTurnSeatId: string | null;
  handComplete: boolean;
  score: TeamScoreView;
  statusText: string;
  turnDeadlineAt: string | null;
  reconnectDeadlineAt: string | null;
  transition: MatchTransitionState;
  state: MatchProgressState;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
}

export interface HandScoredEvent {
  roomCode: string;
  handNumber: number;
  dealerSeatId: string | null;
  currentTurnSeatId: string | null;
  handTrickWins: TeamScoreView;
  handWinnerTeamSide: TeamSide | null;
  tableCards: TablePlayView[];
  resolvedTricks: TrickResultView[];
  score: TeamScoreView;
  scoredAt: string;
  statusText: string;
  turnDeadlineAt: string | null;
  reconnectDeadlineAt: string | null;
  transition: MatchTransitionState;
  state: MatchProgressState;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  summary: MatchSummaryView | null;
}

export interface SummaryStartedEvent {
  roomCode: string;
  summary: MatchSummaryView;
  handNumber: number;
  startedAt: string;
  source: 'match_end' | 'manual' | 'reconnect';
  statusText: string;
  transition: MatchTransitionState;
  state: MatchProgressState;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
}

export interface SessionRecoveredEvent {
  roomCode: string;
  seatId: string | null;
  session: RoomSession | null;
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  recoveredAt: string;
}

/**
 * Gap 3 — DB-backed event replay.
 * Sent after session:recovered when the client provides a serverOffset.
 * Contains the list of actions that occurred while the client was disconnected.
 * payload is omitted server-side to prevent card information leakage (Gap 2).
 */
export interface SessionHistoryEvent {
  roomCode: string;
  missedActions: Array<{
    id: string;
    actionType: string;
    seatId: string | null;
    occurredAt: string; // ISO timestamp
  }>;
}

/**
 * Gap 1 — JSON Patch delta.
 * Sent instead of room:updated when the diff is smaller than the full snapshot.
 * Client applies ops to its last known RoomSnapshot.
 */
export interface RoomPatchEvent {
  roomCode: string;
  stateVersion: number;
  ops: Array<{
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: unknown;
    from?: string;
  }>;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  envidoSinging: EnvidoSingingState | null;
  reason?: string;
}

export interface ActionSubmittedEvent {
  roomCode: string;
  clientActionId: string;
  actionType: string;
  actorSeatId: string | null;
  payload: Record<string, unknown>;
  accepted: boolean;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface ActionRejectedEvent {
  roomCode: string;
  clientActionId: string;
  actionType: string;
  message: string;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface ChatReceivedEvent {
  roomCode: string;
  clientMessageId: string;
  seatId: string | null;
  message: string;
  accepted: boolean;
  state: MatchProgressState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface ReactionReceivedEvent {
  roomCode: string;
  clientReactionId: string;
  seatId: string | null;
  targetSeatId: string | null;
  reaction: string;
  accepted: boolean;
  state: MatchProgressState | null;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  reason?: string;
}

export interface RoomDestroyedEvent {
  roomCode: string;
  roomId: string | null;
  destroyed: boolean;
  snapshot: RoomSnapshot | null;
  matchView: MatchView | null;
  destroyedAt: string;
  destroyedBySeatId: string | null;
  state: MatchProgressState | null;
  transition: MatchTransitionState | null;
  wildcardSelection: DetailedWildcardSelectionState | null;
  reason?: string;
}

export interface RealtimeClientToServerEvents {
  'room:join': (payload: RoomJoinPayload) => void;
  'session:resume': (payload: SessionResumePayload) => void;
  'lobby:toggle-ready': (payload: LobbyActionPayload) => void;
  'lobby:set-team': (payload: LobbyTeamPayload) => void;
  'match:start': (payload: LobbyActionPayload) => void;
  'summary:start': (payload: SummaryStartPayload) => void;
  'game:play-card': (payload: PlayCardPayload) => void;
  'wildcard:request': (payload: WildcardRequestPayload) => void;
  'canto:open': (payload: CantoOpenPayload) => void;
  'canto:resolve': (payload: CantoResolvePayload) => void;
  'wildcard:select': (payload: WildcardSelectPayload) => void;
  'action:submit': (payload: ActionSubmitPayload) => void;
  'chat:send': (payload: ChatSendPayload) => void;
  'reaction:send': (payload: ReactionSendPayload) => void;
  'room:destroy': (payload: RoomDestroyPayload) => void;
  'seat:free': (payload: SeatFreePayload) => void;
  ping: () => void;
}

export interface RealtimeServerToClientEvents {
  'room:joined': (payload: RoomJoinedEvent) => void;
  'room:updated': (payload: RoomUpdatedEvent) => void;
  'room:patch': (payload: RoomPatchEvent) => void;
  'seat:updated': (payload: SeatUpdatedEvent) => void;
  'session:recovered': (payload: SessionRecoveredEvent) => void;
  'session:history': (payload: SessionHistoryEvent) => void;
  'action:submitted': (payload: ActionSubmittedEvent) => void;
  'action:rejected': (payload: ActionRejectedEvent) => void;
  'chat:received': (payload: ChatReceivedEvent) => void;
  'reaction:received': (payload: ReactionReceivedEvent) => void;
  'canto:opened': (payload: CantoOpenedEvent) => void;
  'canto:resolved': (payload: CantoResolvedEvent) => void;
  'wildcard:selection-required': (payload: WildcardSelectionRequiredEvent) => void;
  'wildcard:selected': (payload: WildcardSelectedEvent) => void;
  'envido:wildcard-commit-required': (payload: EnvidoWildcardCommitRequestedEvent) => void;
  'envido:seat-declared': (payload: EnvidoSeatDeclaredEvent) => void;
  'trick:resolved': (payload: TrickResolvedEvent) => void;
  'hand:scored': (payload: HandScoredEvent) => void;
  'summary:started': (payload: SummaryStartedEvent) => void;
  'room:destroyed': (payload: RoomDestroyedEvent) => void;
  'server:restarting': () => void;
  pong: (payload: { ok: boolean; timestamp: string }) => void;
}

export interface RealtimeInterServerEvents {}

export interface RealtimeSocketData {
  roomCode?: string;
  roomSessionToken?: string;
  seatId?: string;
}

export interface GameplayIntent<TPayload = Record<string, unknown>> {
  type: string;
  actorSeatId: string;
  payload: TPayload;
  clientActionId: string;
}

export interface SeatFreePayload extends LobbyActionPayload {
  targetSeatId: string;
}

export interface SeatFreeResult {
  roomCode: string;
  targetSeatId: string;
  freedAt: string;
  snapshot: RoomSnapshot;
}

export interface SeatFreeAck extends SocketAckResult<SeatFreeResult> {
  targetSeatId: string;
}
