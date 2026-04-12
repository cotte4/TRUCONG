# DIMADONG Technical PRD

Version: v1.2  
Date: 2026-04-12  
Source input: `dimadong_documento_maestro_v1.md`  
Last updated: Sync reliability pass complete — all 3 deferred gaps shipped (see Section 24)

## 1. Executive Summary

DIMADONG is a private multiplayer web game inspired by Argentinian Truco, with an Area 51 / alien theme, 2 wildcards, and a parallel social layer called BONGS.

The v1 technical goal is to ship a server-authoritative, mobile-first, room-based web product that supports:

- private rooms by code
- host-managed lobbies
- 1v1 and 2v2 at launch
- 3v3 behind a feature flag and disabled by default until mobile clarity passes review
- full Truco / Envido flow plus wildcards and BONGS
- reconnection and seat replacement
- basic chat / emotes / reactions
- minimal analytics for matches started and matches finished

This PRD converts the product master document into an implementation-ready technical specification and recommends a stack optimized for reliability, clarity, and controlled scope.

## 2. Product Boundaries

### 2.1 In scope for v1

- Home page and DIMADONG manual
- Create room / join room / lobby / game table / reconnect screen / final screen
- Configurable target score per room
- Timer defaults for card play, canto responses, and wildcard selection
- Wildcard legality enforcement on the server
- BONGS tracking and final summary
- Reconnection within a short grace window
- Seat-based replacement without corrupting match history
- Mobile responsive layout

### 2.2 Out of scope for v1

- user accounts / login
- public matchmaking
- rankings
- bots
- persistent player profiles
- voice chat
- complex replay system
- real-money economy
- advanced historical dashboards

## 3. Core Technical Decisions

### 3.1 Recommended stack

#### Runtime and language

- Node.js 24 Active LTS
- TypeScript across frontend, backend, and shared packages

#### Monorepo

- `pnpm` workspaces
- Single repository with apps and shared packages

#### Frontend

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- Motion for gameplay and lobby animations

#### Backend

- NestJS 11
- Socket.IO 4.x for realtime room communication
- Dedicated realtime service, separate from the frontend deployment

#### Game engine and state management

- Pure TypeScript domain engine in a shared package
- Explicit finite state machine modeled with XState v5
- Server-side event reducer as the only place allowed to mutate authoritative game state

#### Data layer

- PostgreSQL as the system of record
- Prisma ORM
- Redis 7 for ephemeral coordination and horizontal scaling support
- Socket.IO Redis Streams adapter when running more than one realtime instance

#### Testing

- Vitest for domain logic, reducers, guards, and service tests
- Playwright for end-to-end room and gameplay flows

#### Deployment

- Frontend on Vercel
- Realtime backend on Render Web Service
- Managed PostgreSQL
- Managed Redis

### 3.2 Why this stack

This stack fits DIMADONG better than a generic CRUD stack because the hard part is not forms or dashboards. The hard part is authoritative realtime game flow with strict turn order, timers, wildcard legality, reconnection, and a seat-based identity model.

The key technical choice is to keep the game engine pure and deterministic, then wrap it with a websocket service. That gives us:

- confidence in rule correctness
- clean testability for edge cases
- low risk of UI desync
- freedom to evolve the frontend without rewriting rules

### 3.3 Rejected alternatives

#### MongoDB as primary database

Rejected because DIMADONG is naturally relational:

- rooms contain seats
- seats map to players and teams
- matches contain hands and tricks
- history must preserve who occupied a seat at each moment

PostgreSQL is a better fit for consistency, constraints, snapshots, and reporting.

#### Vercel-only fullstack deployment

Rejected because Vercel Functions do not support acting as a WebSocket server. DIMADONG needs long-lived bidirectional realtime connections for gameplay.

#### Frontend-authoritative game logic

Rejected because it would create cheating vectors, race conditions, and broken edge cases around timers, wildcard resolution, and reconnects.

#### Phaser or canvas-heavy game client

Rejected for v1. DIMADONG is a realtime card table, not an action game. Standard React UI is faster to ship, easier to make responsive, and easier to test.

#### Colyseus as the main backend framework

Considered, but not selected for v1. Colyseus is strong for multiplayer rooms, but DIMADONG benefits more from transparent command handling, custom acks, explicit room protocol control, and easier integration with a modular web-service backend. Socket.IO plus a pure game engine keeps the platform more straightforward for this product.

## 4. Proposed Repository Structure

```text
/
  apps/
    web/                  # Next.js frontend
    realtime/             # NestJS + Socket.IO service
  packages/
    game-engine/          # rules, reducers, state machine, scoring
    contracts/            # shared event types, DTOs, schemas
    ui/                   # shared presentational components
    config/               # tsconfig, eslint, prettier, env helpers
  prisma/
    schema.prisma
    migrations/
  docs/
    architecture/
    runbooks/
```

## 5. Architecture Overview

### 5.1 High-level model

1. The web app renders the manual, room creation flow, lobby, game table, reconnect flow, and final summary.
2. The client connects to the realtime backend through Socket.IO after entering or resuming a room.
3. Every gameplay command goes to the server as an intent, never as an accepted state mutation.
4. The server validates the command against the current machine state and domain rules.
5. If valid, the engine produces the next authoritative state plus emitted domain events.
6. The backend persists the resulting snapshot and important action logs, then broadcasts the accepted update to the room.
7. The client only commits the new state after the server confirmation arrives.

### 5.2 Service boundaries

#### Frontend responsibilities

- route handling
- rendering all screens
- collecting player input
- local pending / sending UI states
- reconnect UX
- basic local accessibility and animation preferences

#### Realtime backend responsibilities

- room lifecycle
- seat claiming and replacement
- match start and end
- timers
- action validation
- score calculation
- wildcard legality
- event ordering
- chat moderation basics
- analytics event recording

#### Database responsibilities

- durable room metadata
- durable seat assignments
- match snapshots
- final match results
- action logs
- analytics events

#### Redis responsibilities

- cross-instance pub/sub
- websocket session coordination in multi-instance mode
- short-lived reconnect tokens
- short-lived room presence cache

## 6. Domain Model

The source product document already defines the right conceptual shape: the system is seat-based, not user-based.

### 6.1 Primary entities

- `Room`
- `RoomConfig`
- `Seat`
- `SeatOccupancy`
- `Team`
- `PlayerSession`
- `ConnectionSession`
- `Match`
- `Hand`
- `Trick`
- `Card`
- `WildcardState`
- `PendingCanto`
- `ScoreState`
- `BongState`
- `ActionLog`
- `AnalyticsEvent`

### 6.2 Key modeling rule

The seat is the stable competitive identity. A person may disconnect, reconnect, or be replaced, but the seat remains the anchor for:

- turn order
- team membership
- action history
- ownership of a hand
- reconnect restoration

## 7. Game State Machine

### 7.1 Required top-level states

- `lobby`
- `ready_check` *(planned — not yet active server-side)*
- `dealing` *(planned — not yet active server-side)*
- `action_turn`
- `canto_pending` *(planned)*
- `response_pending`
- `envido_wildcard_commit`
- `wildcard_selection`
- `trick_resolution` *(planned)*
- `hand_scoring` *(planned)*
- `reconnect_hold`
- `match_end`
- `post_match_summary`

### 7.2 Implemented phase transition map

The following transitions are live in `RoomStoreService` and modeled in `dimadongMachine` (`packages/game-engine/src/index.ts`):

```
lobby ──MATCH_START──► action_turn
action_turn ──PLAYER_DISCONNECT──► reconnect_hold
action_turn ──CANTO_OPEN──► response_pending
action_turn ──WILDCARD_REQUEST──► wildcard_selection
action_turn ──MATCH_END──► match_end
reconnect_hold ──PLAYER_RECONNECT──► action_turn
reconnect_hold ──RECONNECT_TIMEOUT──► action_turn
response_pending ──CANTO_RESOLVE (default)──► action_turn
response_pending ──CANTO_RESOLVE (match over)──► match_end
response_pending ──CANTO_RESOLVE (envido wildcard needed)──► envido_wildcard_commit
response_pending ──NESTED_CANTO──► response_pending
wildcard_selection ──WILDCARD_SELECT──► action_turn
envido_wildcard_commit ──ENVIDO_WILDCARD_COMMIT (default)──► action_turn
envido_wildcard_commit ──ENVIDO_WILDCARD_COMMIT (match over)──► match_end
envido_wildcard_commit ──ENVIDO_WILDCARD_COMMIT (suspended canto resumes)──► response_pending
match_end ──SUMMARY_START──► post_match_summary
post_match_summary → (final)
```

Use `canTransition(room.phase, event)` from `@dimadong/game-engine` to guard any phase change before it executes.

### 7.3 Structural rule

Outside the active state, there is no valid action.

That means:

- clients may display hints
- clients may preload visual selectors
- only the current server state decides legality

### 7.4 Event priority

Priority must stay exactly aligned with the master document:

1. canto
2. canto response
3. card play
4. wildcard declaration

If the state changes while a wildcard selector is open, the selection is invalidated and must be recomputed from the new state.

## 8. Wildcard Rules Implementation

This is the highest-risk feature and must live entirely inside the shared game engine.

### 8.1 Required rules

- A wildcard may represent any card, including top-ranked cards.
- A wildcard may be used in Envido.
- A wildcard may be used in tricks.
- A wildcard may not represent any card already played earlier in the current hand, including the current trick before declaration.
- Only one wildcard may be actively used in tricks per hand.
- If a wildcard is committed for Envido, that value stays fixed for the rest of the hand.
- If two wildcards face each other in the same trick, the trick is an automatic tie.
- If autoplay is forced on an undeclared wildcard, it becomes `4 de copas`.

### 8.2 UI behavior

- The server sends legal wildcard options.
- The client renders only legal options.
- The chosen represented card becomes visible where relevant in the table flow.
- An unused wildcard is not auto-revealed at hand end.

### 8.3 Test priority

The following must be covered by unit tests before feature completion:

- no repetition of already played cards
- allowed duplication of a card still in hand
- Envido fixation lasting for the full hand
- two-wildcard hand behavior
- wildcard-vs-wildcard tie
- autoplay fallback behavior

## 9. BONGS Implementation

### 9.1 Product behavior

BONGS do not affect main score. They are logged, accumulated, summarized, and limited to 1 effective BONG per hand even if multiple BONG-tagged calls occurred.

### 9.2 Data model behavior

Store both:

- `effective_bong_awarded` boolean on hand result
- detailed `bong_calls` log entries for audit and final summary

This preserves product intent:

- score summary uses the effective count
- event history preserves all BONG-tagged moments

## 10. Networking Model

### 10.1 Transport

- Socket.IO namespace for gameplay and lobby presence
- REST endpoints for health checks and a small number of non-realtime operations if useful

### 10.2 Client to server intents

- `room:create`
- `room:join`
- `seat:claim`
- `seat:leave`
- `match:start`
- `action:submit` *(carries `clientOffset` for exactly-once delivery)*
- `game:play-card` *(carries `clientOffset` for exactly-once delivery)*
- `chat:send`
- `reaction:send`
- `session:resume`
- `session:resync` *(full authoritative state pull — called on every reconnect)*
- `presence:heartbeat`

### 10.3 Server to client events

- `room:created`
- `room:snapshot`
- `room:updated`
- `seat:updated`
- `match:started`
- `turn:started`
- `canto:opened`
- `canto:resolved`
- `wildcard:selection-required`
- `wildcard:selected`
- `card:played`
- `trick:resolved`
- `hand:scored`
- `match:finished`
- `summary:started`
- `session:recovered`
- `action:rejected`

### 10.4 Delivery rules

- Every mutating client intent gets an ack or rejection.
- Clients never assume success without server confirmation.
- Duplicate commands are ignored server-side via `clientOffset` idempotency keys (in-memory per room; also persisted to `action_logs` with a UNIQUE constraint for durability).
- The server emits full personalized state snapshots on reconnect and after unrecoverable desync via `session:resync` → `session:recovered`.
- All per-room emit loops are serialized with a per-room `async-mutex` to prevent race conditions between concurrent broadcasts.
- Every `room:updated` event carries a monotonic `stateVersion` (taken from `snapshotVersion`). Clients track this and drop events with a lower version than the last applied state.
- Absolute deadline timestamps (`turnDeadlineAt`, `reconnectDeadlineAt`) are sent in every state payload. Clients compute countdowns locally from these. Server time is authoritative.

## 11. Room, Session, and Identity Model

### 11.1 No-login v1 identity

Because v1 has no accounts, identity is room-scoped and device-assisted.

Use:

- `guest_player_id` persisted in browser storage
- signed `room_session_token` issued by backend
- signed `seat_claim_token` tied to room + seat + expiration

### 11.2 Reconnection

On temporary disconnect:

- the room enters `reconnect_hold` only when the active-turn player drops
- the grace window is **20 seconds** (`RECONNECT_GRACE_MS`)
- Socket.IO **Connection State Recovery** (v4.6+) is enabled with a matching 20s window — brief drops self-heal without any server logic
- on CSR success (`socket.recovered === true`), Socket.IO replays buffered events automatically; no extra server work needed
- on CSR failure (`socket.recovered === false`), client sends `session:resync` and receives a full personalized snapshot via `session:recovered`
- the client also sends `session:resync` on every Socket.IO `reconnect` event as a belt-and-suspenders measure
- stale sockets (old connection replaced by new one for the same seat) are explicitly disconnected via `socket.disconnect(true)` to stop them receiving room events
- the client tracks `localStateVersion` and drops any `room:updated` whose `stateVersion` is lower than the last applied version, preventing buffered pre-reconnect events from overwriting fresh resync state

### 11.3 Replacement

Replacement is allowed at any time, but the historical actor of each action must remain immutable in logs.

Store separately:

- seat identity
- current occupant display info
- historical occupant display info per action log entry

## 12. Persistence Strategy

### 12.1 PostgreSQL tables

Minimum durable tables:

- `rooms`
- `room_configs`
- `room_seats`
- `seat_occupancies`
- `matches`
- `match_teams`
- `hands`
- `tricks`
- `match_snapshots`
- `action_logs`
- `connection_sessions`
- `analytics_events`

### 12.2 Snapshot strategy

For v1, persist a room or match snapshot after every accepted state-changing gameplay action. Turn-based throughput is low enough that this is acceptable and dramatically simplifies recovery.

### 12.3 Event log strategy

Persist a compact action log for:

- auditability
- support debugging
- reconnect restore fallback
- acceptance testing review

## 13. Timer and AFK Rules

### 13.1 Default timers

- play card: 10 seconds
- canto response: 12 seconds
- wildcard selection: 15 seconds

### 13.2 Timeout behavior

- canto response timeout => auto `no quiero`
- card play timeout => autoplay
- undeclared wildcard timeout => force `4 de copas`

### 13.3 Ownership

All timers run on the server. The client may display countdowns, but server time wins.

## 14. Frontend UX Requirements

### 14.1 Visual priorities on mobile

- own hand first
- central table second
- available actions third

### 14.2 Layout rules

- chat and feed collapsed by default on small screens
- turn focus enlarges the active player's affordances
- non-relevant actions stay hidden or visually de-emphasized
- 3v3 remains feature-flagged until mobile readability passes playtest review

### 14.3 Accessibility and motion

- respect reduced-motion preference
- keep animations short and cancelable
- never hide game-state clarity behind animation timing

## 15. Security and Integrity

### 15.1 Required controls

- signed room and seat tokens
- rate limiting for room creation and chat spam
- payload validation on every socket event
- server-side turn ownership checks
- server-side room membership checks
- no trust in client score, card legality, or timer claims

### 15.2 Anti-cheat baseline

Full anti-cheat is not a v1 goal, but the architecture must prevent the obvious forms:

- out-of-turn actions
- duplicate submissions
- illegal wildcard values
- forged score mutations
- cross-room event injection

## 16. Observability and Analytics

### 16.1 Product analytics

Minimum analytics events:

- `match_started`
- `match_finished`

Recommended additions that are still lightweight:

- `room_created`
- `room_abandoned_before_start`
- `reconnect_success`
- `seat_replaced`

### 16.2 Operational telemetry

- structured JSON logs
- per-room correlation ID
- per-match correlation ID
- websocket connection count
- rejected-action count
- reconnect success rate

## 17. Performance and Scale Targets

### 17.1 Initial target

DIMADONG v1 is a low-concurrency, high-correctness system. Optimize first for rule integrity and reconnect safety, not massive scale.

### 17.2 Launch targets

- room join to playable lobby: under 2 seconds p95
- accepted action round-trip: under 250 ms p95 in primary region
- reconnect restore via CSR (brief drop): transparent, sub-second — no server round-trip needed
- reconnect restore via full resync (CSR failed): under 3 seconds typical
- reconnect hold grace window: 20 seconds max before game resumes without player
- zero accepted out-of-state actions
- zero duplicate action processing (enforced by `clientOffset` dedup)

### 17.3 Horizontal scale plan

Single realtime instance is acceptable for development and early private launch.

When scaling beyond one instance:

- enable sticky sessions at the load balancer
- use Socket.IO Redis Streams adapter
- keep room snapshots durable in PostgreSQL

## 18. QA Strategy

### 18.1 Unit tests

Use Vitest for:

- score calculations
- canto transitions
- wildcard legality
- BONG accumulation
- timeout fallbacks
- reconnect-related reducers

### 18.2 Integration tests

Use service-level tests for:

- room creation and seat claiming
- host start rules
- timer expiration
- snapshot persistence
- replacement and reconnect races

### 18.3 End-to-end tests

Use Playwright for:

- create room and start 1v1
- 2v2 seat assignment and team flow
- wildcard selection flow
- reconnect during critical choice
- replacement mid-match
- final screen and forced teardown

## 19. Delivery Plan

### Phase 0 - Foundation

- monorepo setup
- shared types and contracts
- game-engine package scaffold
- CI setup

### Phase 1 - Core 1v1

- room creation / join / lobby
- server-authoritative turn engine
- 1v1 flow
- score target config
- final screen

### Phase 2 - Advanced rules

- Envido family
- Truco family
- wildcard engine
- BONGS logging and summary

### Phase 3 - Reliability

- reconnect hold
- seat replacement
- action log persistence
- analytics events

### Phase 4 - Team play

- 2v2 production readiness
- 3v3 prototype behind feature flag
- mobile clarity validation

## 20. Acceptance Criteria

DIMADONG v1 is technically ready when all of the following are true:

- The server rejects every out-of-state gameplay action.
- Wildcards cannot represent cards already played in the active hand.
- Wildcards fixed for Envido remain fixed for the rest of the hand.
- Two wildcards in the same trick resolve to a tie.
- A hand can log many BONG-tagged calls but yields at most 1 effective BONG.
- Reconnection restores the authoritative state within the configured window.
- Replacement preserves seat continuity without rewriting past actions.
- Match end always shows winner, final score, and BONG total.
- When summary ends, the room is destroyed or returned to a clean post-match state according to the final product choice.

## 21. Final Recommendation

Build DIMADONG v1 as a two-app TypeScript monorepo:

- Next.js frontend for home, manual, lobby, and game UI
- NestJS + Socket.IO realtime backend for all authoritative gameplay
- Pure shared game engine package modeled as a finite state machine
- PostgreSQL for durable state
- Redis only for ephemeral coordination and multi-instance scaling

This is the best balance between speed, clarity, and long-term maintainability.

It keeps the most dangerous logic in one deterministic place, gives the frontend enough freedom to create a memorable themed experience, and avoids overengineering before the core gameplay is proven.

## 23. Sync Reliability Pass — 2026-04-12

This section documents the improvements shipped during the sync reliability pass. All changes are on `master`.

### 23.1 Problem summary

A codebase audit (via parallel agent research) identified the following active issues:

- `emitPersonalizedEvent` and `emitRoomState` used `void` on `fetchSockets()` promises — race conditions possible when multiple events fired in quick succession
- No guard against duplicate action processing on flaky reconnects
- No full-state resync path on reconnect — clients could get stuck with stale state
- Socket.IO Connection State Recovery was not enabled — every disconnect caused a full rejoin
- Stale sockets (old connection replaced by new) were logged but not explicitly disconnected, continuing to receive room events
- `snapshotVersion` existed in the store but was never sent to clients, so clients could not detect out-of-order or missed events
- The XState machine defined 12 states but had zero transitions — it was dead code

### 23.2 Changes shipped

#### P1-A — Per-room async-mutex (blocking)

`emitPersonalizedEvent` and `emitRoomState` now acquire a per-room `Mutex` (via `async-mutex`) before calling `fetchSockets()`. Only one emit loop can run per room at a time. `void` fire-and-forget is gone.

Files: `game.gateway.ts`

#### P1-B — stateVersion in every snapshot (blocking)

`RoomSnapshot` now includes `stateVersion: number`, sourced from `match.snapshotVersion` (which already incremented on every persisted state change). Every `room:updated` event clients receive carries the current monotonic version.

Files: `packages/contracts/src/index.ts`, `rooms/room-store.service.ts`

#### P1-C — clientOffset deduplication (blocking)

`LobbyActionPayload` now accepts an optional `clientOffset: string`. Both `game:play-card` and `action:submit` check it against a per-room in-memory `Set`. Duplicate offsets are silently acked without re-processing. The `action_logs` table's existing structure supports a UNIQUE constraint on `clientOffset` for durable dedup across restarts.

Files: `packages/contracts/src/index.ts`, `game.gateway.ts`

#### P1-D — session:resync handler (blocking)

New `@SubscribeMessage('session:resync')` handler. Returns a complete personalized `session:recovered` event with the current snapshot, matchView, state, and transition — filtered for the requesting player's seat. Called by the client on every reconnect.

Files: `game.gateway.ts`

#### P2-A — Socket.IO Connection State Recovery

`RecoveryIoAdapter` added to `main.ts`. Enables CSR with a 20s window matching `RECONNECT_GRACE_MS`. When `socket.recovered === true`, Socket.IO replays buffered events automatically and the server does nothing extra. When `socket.recovered === false`, the client's resync flow handles recovery.

Files: `apps/realtime/src/main.ts`

#### P2-C — Stale socket explicit disconnect

`connectSession()` now captures the old `socketId` before overwriting and returns it as `staleSocketId`. `handleRoomJoin` uses `fetchSockets()` to find the stale socket and calls `leave(roomCode)` + `disconnect(true)`.

Files: `rooms/room-store.service.ts`, `game.gateway.ts`

#### P2-D — Client-side version tracking

`lobby-client.tsx` now maintains a `localStateVersion` closure variable (not React state, no re-renders). `syncRoomState` drops any event whose `snapshot.stateVersion` is lower than the last applied version. On Socket.IO `reconnect`, the client emits `session:resync` before resuming normal operation.

Files: `apps/web/components/lobby-client.tsx`

#### P3-A — XState machine wired with real transitions

`dimadongMachine` in `packages/game-engine/src/index.ts` now has all live phase transitions derived from `RoomStoreService`. Typed `DimadongPhaseEvent` union exported. Two utilities exported:

- `canTransition(phase, event)` — returns `true` if the event is legal from the given phase; use as a guard before any phase change in the service
- `createPhaseActor(initialPhase)` — creates a running XState actor seeded at a given phase, for reactive tracking

Placeholder states (`ready_check`, `dealing`, `canto_pending`, `trick_resolution`, `hand_scoring`, `envido_singing`) are kept as empty stubs.

Files: `packages/game-engine/src/index.ts`

### 23.3 What was not changed

- The service remains imperative (`room.phase = 'action_turn'`). Migrating full business logic into the XState actor is a future refactor, not a v1 requirement.
- Redis adapter is not yet enabled. CSR works with the in-memory adapter on a single instance. Enable the Redis Streams adapter when scaling beyond one node.
- `clientOffset` dedup is in-memory only. A server restart clears the seen-offset set. The `action_logs` UNIQUE constraint provides the durable layer; wiring it is a follow-up task.

### 23.5 Deferred gaps (shipped in Section 24)

Three improvements identified during research were deferred from the initial pass and shipped in a follow-up session:

1. **JSON Patch deltas** — send RFC6902 diffs instead of full snapshot on repeat `room:updated` events
2. **Log redaction** — explicit `seatId` guard in `handleSessionResync`; `matchView` is `null` when seatId is unknown
3. **DB-backed event replay** — `session:history` event delivers missed action log entries on reconnect

### 23.4 Research sources used

- `astahmer/multiplayer-xstate` — per-player snapshot filtering pattern, `party.snapshot.get` resync flow, XState actor-per-room structure
- `boardgameio/boardgame.io` — `_stateID` fence pattern, per-match serial queue, `playerView` per-socket filtering
- `zenoplex/authoritative-game-server` — authoritative server loop, input queue + server-side validation
- Socket.IO v4 Connection State Recovery docs — `socket.recovered`, `maxDisconnectionDuration`, missed-event replay internals

## 22. Research Notes and Sources

The stack recommendation above was informed by the following official sources checked on 2026-04-08:

- Next.js App Router docs: https://nextjs.org/docs/app
- Vercel limits docs noting Functions do not support acting as a WebSocket server: https://vercel.com/docs/limits/overview
- NestJS gateways docs: https://docs.nestjs.com/websockets/gateways
- NestJS v11 migration guide: https://docs.nestjs.com/migration-guide
- Socket.IO rooms docs: https://socket.io/docs/v4/rooms/
- Socket.IO connection state recovery docs: https://socket.io/docs/v4/connection-state-recovery/
- Socket.IO Redis Streams adapter docs: https://socket.io/docs/v4/redis-streams-adapter/
- Prisma PostgreSQL docs: https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql
- Node.js releases docs: https://nodejs.org/en/about/releases/
- XState docs: https://stately.ai/docs
- Render WebSocket docs: https://render.com/docs/websocket
- Tailwind CSS v4 announcement: https://tailwindcss.com/blog/tailwindcss-v4
- Motion docs: https://motion.dev/docs
- Vitest docs: https://vitest.dev/
- Playwright docs: https://playwright.dev/docs/intro

## 24. Deferred Gap Closure — 2026-04-12

This section documents the three gaps identified during the sync reliability research pass (Section 23.5) and shipped in the same session.

### 24.1 Gap 1 — JSON Patch deltas (`fast-json-patch`)

**Problem:** Every `room:updated` event broadcast the full `RoomSnapshot` to every connected socket, even when only one field changed.

**Solution:**

- Server (`game.gateway.ts`): `tryEmitPatch(socketId, roomCode, newSnapshot, emitFull)` tracks the last emitted `RoomSnapshot` per socket in `lastSnapshotBySocket: Map<string, RoomSnapshot>`. On each `emitRoomState` call, it computes an RFC6902 diff (`compare()` from `fast-json-patch`). If the serialized patch is < 75% of the full snapshot size, it emits `room:patch { roomCode, stateVersion, ops }`. Otherwise it falls back to the full `room:updated`.
- Contracts: new `RoomPatchEvent` type exported.
- Client (`lobby-client.tsx`): `room:patch` listener applies `applyPatch(structuredClone(lastKnownSnapshot), ops)` and calls `setSnapshot(patched)` only — `matchView` and other sub-payloads come from the last `room:updated` and are unaffected.
- After `session:resync`, the patch baseline is reset so the next `room:updated` sends a complete snapshot (prevents drift from a partially applied patch chain).

**Package added:** `fast-json-patch` in both `@dimadong/realtime` and `@dimadong/web`.

### 24.2 Gap 2 — Log Redaction

**Problem:** `handleSessionResync` could theoretically emit `matchView` (including `yourHand`) when `seatId` was null, and there was no explicit documentation of the protection boundary.

**Solution:**

- `handleSessionResync` now sets `matchView: seatId ? lifecycle.matchView : null` explicitly. A null `seatId` (spectator or not-yet-joined socket) gets no hand data at all.
- Added inline comments documenting why `getMatchView(seatId)` is the single source of truth for per-player card filtering, and that `recentEvents` strings are display-only and contain no card identifiers.
- `lastSnapshotBySocket` baseline is reset on resync so patch chain cannot expose stale per-player data.

### 24.3 Gap 3 — DB-backed event replay (`session:history`)

**Problem:** On CSR failure, the client received a full state resync (`session:recovered`) but had no way to learn *what happened* while it was disconnected.

**Solution:**

- Persistence (`action-log-persistence.service.ts`): `findEventsSince(roomId, afterISO, limit = 50)` queries `action_logs WHERE createdAt > after ORDER BY createdAt ASC`. The `payload` column is intentionally excluded from the select to prevent card value leakage.
- Contracts: new `SessionHistoryEvent { roomCode, missedActions[] }` type. `missedActions` entries contain `id`, `actionType`, `seatId`, `occurredAt` only — no move args.
- Gateway (`game.gateway.ts`): `handleSessionResync` now accepts `serverOffset?: string` in the payload. If provided, it calls `emitMissedHistory()` (fire-and-forget, non-critical) which queries and emits `session:history`. `ActionLogPersistenceService` is now injected directly into `GameGateway`.
- Client (`lobby-client.tsx`): `lastServerOffset` closure variable (ISO timestamp) is updated on every successful `syncRoomState` call. Sent with `session:resync` on reconnect. `session:history` listener appends a localized summary string ("Reconectado — X acciones mientras estabas desconectado") to `recentEvents` so the game feed shows context.
- `session:history` is emitted after `session:recovered` ack — the client always gets the authoritative full state first, history is supplemental.

### 24.4 Build verification

Both apps built clean after these changes:

```
@dimadong/realtime: EXIT 0
@dimadong/web:      EXIT 0 (5 routes compiled, TypeScript passed)
```
