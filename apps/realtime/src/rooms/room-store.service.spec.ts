/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoomStoreService } from './room-store.service';
import type { CardSuit } from '@dimadong/contracts';

function createMockDependency(label: string) {
  return new Proxy(
    {},
    {
      get: (_, property) => {
        if (property === 'then') {
          return undefined;
        }

        if (property === Symbol.toStringTag) {
          return label;
        }

        return () => undefined;
      },
    },
  );
}

async function createService() {
  const paramTypes: unknown[] =
    Reflect.getMetadata('design:paramtypes', RoomStoreService) ?? [];

  const providers = paramTypes
    .filter((dependency) => dependency && dependency !== Object)
    .map((dependency, index) => ({
      provide: dependency as never,
      useValue: createMockDependency(`room-store-dependency-${index}`),
    }));

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [RoomStoreService, ...providers],
  }).compile();

  const service = moduleRef.get(RoomStoreService);
  const noop = jest.fn();

  for (const hookName of [
    'persistRoomCreated',
    'persistSeatClaim',
    'persistReconnect',
    'persistAction',
    'persistSnapshot',
    'persistMatchStarted',
    'persistMatchFinished',
  ]) {
    if (typeof service[hookName] !== 'function') {
      service[hookName] = noop;
    }
  }

  return service;
}

function createCard(id: string, rank: number, suit: CardSuit) {
  return {
    id,
    rank,
    suit,
    label: `${rank} de ${suit}`,
    isWildcard: false,
  };
}

function setHand(
  service: RoomStoreService,
  roomCode: string,
  seatId: string,
  cards: Array<ReturnType<typeof createCard>>,
) {
  const room = service['roomsByCode'].get(roomCode);
  room.match.handsBySeatId[seatId] = cards;
}

describe('RoomStoreService', () => {
  let service: RoomStoreService;

  beforeEach(async () => {
    jest.useRealTimers();
    service = await createService();
  });

  it('creates a room with the creator occupying the host seat', () => {
    const result = service.createRoom({
      displayName: 'Franco',
      maxPlayers: 4,
    });

    expect(result.snapshot.seats[0]).toEqual(
      expect.objectContaining({
        displayName: 'Franco',
        isHost: true,
        status: 'occupied',
      }),
    );
    expect(result.session.roomCode).toBe(result.snapshot.code);
  });

  it('joins the next open seat in an existing room', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    expect(joined.snapshot.seats[1]).toEqual(
      expect.objectContaining({
        displayName: 'Guest',
        status: 'occupied',
      }),
    );
  });

  it('requires all players to be ready before the host can start the match', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    expect(() =>
      service.startMatch(
        created.snapshot.code,
        created.session.roomSessionToken,
      ),
    ).toThrow('Every player must mark ready before the match can start.');

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);

    const started = service.startMatch(
      created.snapshot.code,
      created.session.roomSessionToken,
    );

    expect(started.phase).toBe('action_turn');
  });

  it('only allows the host to change team assignments', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    expect(() =>
      service.assignTeam({
        roomCode: created.snapshot.code,
        roomSessionToken: joined.session.roomSessionToken,
        targetSeatId: created.snapshot.seats[0].id,
        teamSide: 'B',
      }),
    ).toThrow('Only the host can change team assignments.');
  });

  it('deals cards on start and allows the active player to play one', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    );
    expect(hostView?.yourHand).toHaveLength(3);

    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      cardId: hostView!.yourHand[0].id,
    });

    const updatedHostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    );
    expect(updatedHostView?.yourHand).toHaveLength(2);
    expect(updatedHostView?.currentTurnSeatId).toBe(joined.session.seatId);
  });

  it('resolves a hand into score progression', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    let snapshot = service.getSnapshot(created.snapshot.code);
    const tokenBySeatId = new Map([
      [created.session.seatId, created.session.roomSessionToken],
      [joined.session.seatId, joined.session.roomSessionToken],
    ]);

    while (
      snapshot.phase === 'action_turn' &&
      snapshot.score.A + snapshot.score.B === 0
    ) {
      const currentTurnSeatId = service.getMatchView(
        created.snapshot.code,
        created.session.seatId,
      )?.currentTurnSeatId;
      const token = tokenBySeatId.get(currentTurnSeatId!);
      const seatView = service.getMatchView(
        created.snapshot.code,
        currentTurnSeatId!,
      );

      service.playCard({
        roomCode: created.snapshot.code,
        roomSessionToken: token!,
        cardId: seatView!.yourHand[0].id,
      });

      snapshot = service.getSnapshot(created.snapshot.code);
    }

    expect(['action_turn', 'match_end']).toContain(snapshot.phase);
    expect(snapshot.score.A + snapshot.score.B).toBe(1);
    expect(snapshot.recentEvents.length).toBeGreaterThan(0);
  });

  it('finishes the match when a team reaches the target score', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 1,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    let snapshot = service.getSnapshot(created.snapshot.code);
    const tokenBySeatId = new Map([
      [created.session.seatId, created.session.roomSessionToken],
      [joined.session.seatId, joined.session.roomSessionToken],
    ]);

    while (snapshot.phase === 'action_turn') {
      const hostView = service.getMatchView(
        created.snapshot.code,
        created.session.seatId,
      )!;
      const token = tokenBySeatId.get(hostView.currentTurnSeatId!)!;
      const actingView = service.getMatchView(
        created.snapshot.code,
        hostView.currentTurnSeatId!,
      )!;

      service.playCard({
        roomCode: created.snapshot.code,
        roomSessionToken: token,
        cardId: actingView.yourHand[0].id,
      });

      snapshot = service.getSnapshot(created.snapshot.code);
    }

    expect(snapshot.phase).toBe('match_end');
    expect(snapshot.winnerTeamSide).toMatch(/A|B/);
    expect(snapshot.score.A + snapshot.score.B).toBe(1);
  });

  it('can move a finished match into post-match summary', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 1,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    let snapshot = service.getSnapshot(created.snapshot.code);
    const tokenBySeatId = new Map([
      [created.session.seatId, created.session.roomSessionToken],
      [joined.session.seatId, joined.session.roomSessionToken],
    ]);

    while (snapshot.phase === 'action_turn') {
      const currentTurnSeatId = service.getMatchView(
        created.snapshot.code,
        created.session.seatId,
      )!.currentTurnSeatId!;
      const actingView = service.getMatchView(
        created.snapshot.code,
        currentTurnSeatId,
      )!;

      service.playCard({
        roomCode: created.snapshot.code,
        roomSessionToken: tokenBySeatId.get(currentTurnSeatId)!,
        cardId: actingView.yourHand[0].id,
      });

      snapshot = service.getSnapshot(created.snapshot.code);
    }

    const summarySnapshot = service.startSummary(
      created.snapshot.code,
      created.session.roomSessionToken,
      'match_end',
    );

    expect(summarySnapshot.phase).toBe('post_match_summary');
    expect(summarySnapshot.winnerTeamSide).toMatch(/A|B/);
  });

  it('returns explicit result data when starting summary', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 1,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    setHand(service, created.snapshot.code, created.session.seatId, [
      createCard('host-envido-a', 7, 'oro'),
      createCard('host-envido-b', 6, 'oro'),
      createCard('host-envido-c', 4, 'copa'),
    ]);
    setHand(service, created.snapshot.code, joined.session.seatId, [
      createCard('guest-envido-a', 5, 'espada'),
      createCard('guest-envido-b', 4, 'espada'),
      createCard('guest-envido-c', 1, 'basto'),
    ]);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'no_quiero',
    );

    const result = service.startSummaryWithResult(
      created.snapshot.code,
      created.session.roomSessionToken,
      'match_end',
    );

    expect(result.summaryStarted).toBe(true);
    expect(result.source).toBe('match_end');
    expect(result.snapshot.phase).toBe('post_match_summary');
    expect(result.lifecycle.transitionState?.matchComplete).toBe(true);
  });

  it('only allows the host to destroy the room', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    expect(() =>
      service.destroyRoom(
        created.snapshot.code,
        joined.session.roomSessionToken,
      ),
    ).toThrow('Only the host can destroy the room.');

    const destroyedSnapshot = service.destroyRoom(
      created.snapshot.code,
      created.session.roomSessionToken,
    );

    expect(destroyedSnapshot.code).toBe(created.snapshot.code);
    expect(() => service.getSnapshot(created.snapshot.code)).toThrow(
      'Room not found.',
    );
  });

  it('blocks card play while a canto response is pending', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;

    expect(() =>
      service.playCard({
        roomCode: created.snapshot.code,
        roomSessionToken: created.session.roomSessionToken,
        cardId: hostView.yourHand[0].id,
      }),
    ).toThrow('Cards can only be played during an active turn.');
  });

  it('resolves a declined canto and resumes the room', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    const before = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;

    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    const snapshot = service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'no_quiero',
    );
    const after = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;

    expect(snapshot.phase).toBe('action_turn');
    expect(snapshot.score.A + snapshot.score.B).toBe(1);
    expect(after.handNumber).toBe(before.handNumber + 1);
    expect(after.currentTurnSeatId).not.toBe(before.currentTurnSeatId);
  });

  it('finishes the match when truco is declined at the target score', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 1,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );

    const snapshot = service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'no_quiero',
    );

    expect(snapshot.phase).toBe('match_end');
    expect(snapshot.winnerTeamSide).toBe('A');
    expect(snapshot.score.A).toBe(1);
  });

  it('supports requesting and resolving wildcard selection', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;
    const wildcard = hostView.yourHand.find((card) => card.isWildcard);

    if (!wildcard) {
      return;
    }

    const requested = service.requestWildcardSelection(
      created.snapshot.code,
      created.session.roomSessionToken,
      wildcard.id,
    );

    expect(requested.phase).toBe('wildcard_selection');

    const selected = service.selectWildcard(
      created.snapshot.code,
      created.session.roomSessionToken,
      wildcard.id,
      '1 de espada',
    );
    const updated = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;
    const resolvedWildcard = updated.yourHand.find(
      (card) => card.id === wildcard.id,
    );

    expect(selected.phase).toBe('action_turn');
    expect(resolvedWildcard).toEqual(
      expect.objectContaining({
        rank: 1,
        suit: 'espada',
        label: '1 de espada',
        isWildcard: false,
      }),
    );
  });

  it('returns explicit result data when opening canto', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const result = service.openCantoWithResult(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );

    expect(result.responsePending).toBe(true);
    expect(result.snapshot.phase).toBe('response_pending');
    expect(result.lifecycle.progressState?.phase).toBe('response_pending');
  });

  it('returns explicit result data when requesting and selecting wildcard', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;
    const wildcard = hostView.yourHand.find((card) => card.isWildcard);

    if (!wildcard) {
      return;
    }

    const requested = service.requestWildcardSelectionWithResult(
      created.snapshot.code,
      created.session.roomSessionToken,
      wildcard.id,
    );

    expect(requested.selectionPending).toBe(true);
    expect(requested.selectionResolved).toBe(false);
    expect(requested.lifecycle.wildcardSelectionState?.cardId).toBe(
      wildcard.id,
    );

    const selected = service.selectWildcardWithResult(
      created.snapshot.code,
      created.session.roomSessionToken,
      wildcard.id,
      '1 de espada',
    );

    expect(selected.selectionPending).toBe(false);
    expect(selected.selectionResolved).toBe(true);
    expect(selected.snapshot.phase).toBe('action_turn');
  });

  it('exposes match progress state after a match starts', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const progress = service.getMatchProgressState(created.snapshot.code);

    expect(progress).toEqual(
      expect.objectContaining({
        phase: 'action_turn',
        handNumber: 1,
        trickNumber: 1,
        currentTurnSeatId: expect.any(String),
        score: { A: 0, B: 0 },
      }),
    );
  });

  it('exposes pending wildcard selection state while selection is open', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;
    const wildcard = hostView.yourHand.find((card) => card.isWildcard);

    if (!wildcard) {
      return;
    }

    service.requestWildcardSelection(
      created.snapshot.code,
      created.session.roomSessionToken,
      wildcard.id,
    );

    const selection = service.getPendingWildcardSelectionState(
      created.snapshot.code,
    );

    expect(selection).toEqual(
      expect.objectContaining({
        seatId: created.session.seatId,
        cardId: wildcard.id,
        availableLabels: expect.arrayContaining(['4 de copa']),
        phase: 'wildcard_selection',
        isPending: true,
        ownerSeatId: created.session.seatId,
        availableChoices: expect.arrayContaining([
          expect.objectContaining({
            id: '4_de_copa',
            label: '4 de copa',
          }),
        ]),
        responseDeadlineAt: expect.any(String),
        fixedForEnvido: false,
      }),
    );
  });

  it('exposes transition state after a trick resolves', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const tokenBySeatId = new Map([
      [created.session.seatId, created.session.roomSessionToken],
      [joined.session.seatId, joined.session.roomSessionToken],
    ]);

    for (let playIndex = 0; playIndex < 2; playIndex += 1) {
      const progress = service.getMatchProgressState(created.snapshot.code)!;
      const actingSeatId = progress.currentTurnSeatId!;
      const view = service.getMatchView(created.snapshot.code, actingSeatId)!;

      service.playCard({
        roomCode: created.snapshot.code,
        roomSessionToken: tokenBySeatId.get(actingSeatId)!,
        cardId: view.yourHand[0].id,
      });
    }

    const transition = service.getMatchTransitionState(created.snapshot.code);

    expect(transition).toEqual(
      expect.objectContaining({
        phaseDetail: expect.any(String),
        activeActionSeatId: expect.any(String),
        latestTrickResult: expect.objectContaining({
          trickNumber: 1,
        }),
        latestTrickResolvedAt: expect.any(String),
        trickResult: expect.objectContaining({
          state: 'resolved',
          resolvedAt: expect.any(String),
        }),
        handComplete: false,
        handSummary: expect.objectContaining({
          state: 'idle',
        }),
        matchComplete: false,
        matchSummary: expect.objectContaining({
          state: 'idle',
        }),
      }),
    );
  });

  it('exposes a combined lifecycle bundle for realtime consumers', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const lifecycle = service.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );

    expect(lifecycle.progressState).toEqual(
      expect.objectContaining({
        phase: 'action_turn',
        handNumber: 1,
      }),
    );
    expect(lifecycle.matchView).toEqual(
      expect.objectContaining({
        handNumber: 1,
        trickNumber: 1,
      }),
    );
    expect(lifecycle.transitionState).toEqual(
      expect.objectContaining({
        handComplete: false,
        matchComplete: false,
        latestTrickResolvedAt: null,
        lastHandScoredAt: null,
        lastHandWinnerTeamSide: null,
      }),
    );
    expect(lifecycle.wildcardSelectionState).toBeNull();
    expect(lifecycle.transitionState).toEqual(
      expect.objectContaining({
        phaseDetail: expect.any(String),
        activeActionSeatId: expect.any(String),
        trickResult: expect.objectContaining({
          state: 'idle',
        }),
        handSummary: expect.objectContaining({
          state: 'idle',
        }),
        matchSummary: expect.objectContaining({
          state: 'idle',
        }),
      }),
    );
  });

  it('marks hand and match summaries as resolved after match end', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 1,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'no_quiero',
    );

    const lifecycle = service.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );

    expect(lifecycle.transitionState).toEqual(
      expect.objectContaining({
        handComplete: true,
        matchComplete: true,
        handSummary: expect.objectContaining({
          state: 'resolved',
          resolvedAt: expect.any(String),
          finalScore: expect.objectContaining({
            A: expect.any(Number),
            B: expect.any(Number),
          }),
          winnerTeamSide: expect.stringMatching(/A|B/),
        }),
        matchSummary: expect.objectContaining({
          state: 'resolved',
          resolvedAt: expect.any(String),
          finalScore: expect.objectContaining({
            A: expect.any(Number),
            B: expect.any(Number),
          }),
          winnerTeamSide: expect.stringMatching(/A|B/),
        }),
      }),
    );
  });

  it('routes generic action submit to card play', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;
    const updatedSnapshot = service.submitAction({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      clientActionId: 'act-1',
      actionType: 'play_card',
      payload: {
        cardId: hostView.yourHand[0].id,
      },
    });

    expect(updatedSnapshot.phase).toBe('action_turn');
    expect(
      service.getMatchView(created.snapshot.code, created.session.seatId)
        ?.yourHand,
    ).toHaveLength(2);
  });

  it('returns explicit post-play result flags for trick and hand transitions', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const tokenBySeatId = new Map([
      [created.session.seatId, created.session.roomSessionToken],
      [joined.session.seatId, joined.session.roomSessionToken],
    ]);

    const firstProgress = service.getMatchProgressState(created.snapshot.code)!;
    const firstView = service.getMatchView(
      created.snapshot.code,
      firstProgress.currentTurnSeatId!,
    )!;
    const firstResult = service.playCardWithResult({
      roomCode: created.snapshot.code,
      roomSessionToken: tokenBySeatId.get(firstProgress.currentTurnSeatId!)!,
      cardId: firstView.yourHand[0].id,
    });

    expect(firstResult.trickResolved).toBe(false);
    expect(firstResult.handScored).toBe(false);
    expect(firstResult.summaryStarted).toBe(false);

    const secondProgress = service.getMatchProgressState(
      created.snapshot.code,
    )!;
    const secondView = service.getMatchView(
      created.snapshot.code,
      secondProgress.currentTurnSeatId!,
    )!;
    const secondResult = service.playCardWithResult({
      roomCode: created.snapshot.code,
      roomSessionToken: tokenBySeatId.get(secondProgress.currentTurnSeatId!)!,
      cardId: secondView.yourHand[0].id,
    });

    expect(secondResult.trickResolved).toBe(true);
    expect(secondResult.lifecycle.transitionState?.latestTrickResult).toEqual(
      expect.objectContaining({
        trickNumber: 1,
      }),
    );
  });

  it('rejects unsupported generic action types', () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });

    expect(() =>
      service.submitAction({
        roomCode: created.snapshot.code,
        roomSessionToken: created.session.roomSessionToken,
        clientActionId: 'act-2',
        actionType: 'dance',
        payload: {},
      }),
    ).toThrow('Unsupported action type: dance');
  });

  it('routes generic action submit to canto open', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const updatedSnapshot = service.submitAction({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      clientActionId: 'act-3',
      actionType: 'canto_open',
      payload: {
        cantoType: 'truco',
        targetSeatId: joined.session.seatId,
      },
    });

    expect(updatedSnapshot.phase).toBe('response_pending');
    expect(
      service.getSnapshot(created.snapshot.code).statusText.toLowerCase(),
    ).toContain('truco');
  });

  it('routes generic action submit to canto resolve', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.submitAction({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      clientActionId: 'act-4',
      actionType: 'canto_open',
      payload: {
        cantoType: 'truco',
        targetSeatId: joined.session.seatId,
      },
    });

    const updatedSnapshot = service.submitAction({
      roomCode: created.snapshot.code,
      roomSessionToken: joined.session.roomSessionToken,
      clientActionId: 'act-5',
      actionType: 'canto_resolve',
      payload: {
        response: 'no_quiero',
      },
    });

    expect(updatedSnapshot.phase).toBe('action_turn');
    expect(updatedSnapshot.score.A + updatedSnapshot.score.B).toBe(1);
  });

  it('returns explicit result data when resolving canto', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );

    const accepted = service.resolveCantoWithResult(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );

    expect(accepted.handValueChanged).toBe(true);
    expect(accepted.scoreDelta).toEqual({ A: 0, B: 0 });
    expect(accepted.matchEnded).toBe(false);

    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'retruco',
      joined.session.seatId,
    );
    const declined = service.resolveCantoWithResult(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'no_quiero',
    );

    expect(declined.handValueChanged).toBe(true);
    expect(declined.scoreDelta).toEqual({ A: 2, B: 0 });
  });

  it('raises the live hand value when truco is accepted', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );

    const tokenBySeatId = new Map([
      [created.session.seatId, created.session.roomSessionToken],
      [joined.session.seatId, joined.session.roomSessionToken],
    ]);

    for (let guard = 0; guard < 8; guard += 1) {
      const progress = service.getMatchProgressState(created.snapshot.code);

      if (
        !progress ||
        progress.phase !== 'action_turn' ||
        !progress.currentTurnSeatId
      ) {
        break;
      }

      const actingSeatId = progress.currentTurnSeatId;
      const view = service.getMatchView(created.snapshot.code, actingSeatId)!;

      service.playCard({
        roomCode: created.snapshot.code,
        roomSessionToken: tokenBySeatId.get(actingSeatId)!,
        cardId: view.yourHand[0].id,
      });
    }

    const lifecycle = service.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );
    const totalScore =
      (lifecycle.progressState?.score.A ?? 0) +
      (lifecycle.progressState?.score.B ?? 0);

    expect(totalScore).toBe(2);
    expect(lifecycle.transitionState?.matchComplete).toBe(true);
  });

  it('only allows retruco after truco is accepted', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    expect(() =>
      service.openCanto(
        created.snapshot.code,
        created.session.roomSessionToken,
        'retruco',
        joined.session.seatId,
      ),
    ).toThrow('retruco can only be called after truco is accepted.');

    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );

    expect(() =>
      service.openCanto(
        created.snapshot.code,
        created.session.roomSessionToken,
        'retruco',
        joined.session.seatId,
      ),
    ).not.toThrow();
  });

  it('raises the live hand value through retruco and vale cuatro', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 4,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'retruco',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'vale_cuatro',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );

    const lifecycle = service.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );
    expect(lifecycle.progressState?.statusText.toLowerCase()).toContain(
      'hand value: 4',
    );
  });

  it('awards accepted envido to the team with the better hand and can finish the match', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'envido',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );

    const lifecycle = service.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );
    const totalScore =
      (lifecycle.progressState?.score.A ?? 0) +
      (lifecycle.progressState?.score.B ?? 0);

    expect(totalScore).toBe(2);
    expect(lifecycle.transitionState?.matchComplete).toBe(true);
    expect(lifecycle.transitionState?.matchSummary.winnerTeamSide).toMatch(
      /A|B/,
    );
  });

  it('auto-resolves a pending canto as no quiero on timeout', async () => {
    jest.useFakeTimers();

    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );

    jest.advanceTimersByTime(12_100);
    await Promise.resolve();

    const snapshot = service.getSnapshot(created.snapshot.code);
    expect(snapshot.phase).toBe('action_turn');
    expect(snapshot.score.A + snapshot.score.B).toBe(1);
  });

  it('does not auto-play a card when the turn timer expires', async () => {
    jest.useFakeTimers();

    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const beforeTimeout = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;

    expect(beforeTimeout.currentTurnSeatId).toBe(created.session.seatId);
    expect(beforeTimeout.tableCards).toHaveLength(0);
    expect(beforeTimeout.yourHand).toHaveLength(3);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const afterTimeout = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;

    expect(afterTimeout.currentTurnSeatId).toBe(created.session.seatId);
    expect(afterTimeout.tableCards).toHaveLength(0);
    expect(afterTimeout.yourHand).toHaveLength(3);
    expect(
      service.getSnapshot(created.snapshot.code).turnDeadlineAt,
    ).toBeNull();
  });

  it('auto-selects wildcard as 4 de copa on timeout', async () => {
    jest.useFakeTimers();

    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;
    const wildcard = hostView.yourHand.find((card) => card.isWildcard);

    if (!wildcard) {
      return;
    }

    service.requestWildcardSelection(
      created.snapshot.code,
      created.session.roomSessionToken,
      wildcard.id,
    );

    jest.advanceTimersByTime(15_100);
    await Promise.resolve();

    const updated = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;
    expect(
      updated.yourHand.some(
        (card) => card.id === wildcard.id && card.label === '4 de copa',
      ),
    ).toBe(true);
  });

  it('supports a full 1v1 MVP happy path from room creation to summary', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 2,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);
    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );

    const tokenBySeatId = new Map([
      [created.session.seatId, created.session.roomSessionToken],
      [joined.session.seatId, joined.session.roomSessionToken],
    ]);

    for (let guard = 0; guard < 12; guard += 1) {
      const progress = service.getMatchProgressState(created.snapshot.code);

      if (
        !progress ||
        progress.phase !== 'action_turn' ||
        !progress.currentTurnSeatId
      ) {
        break;
      }

      const actingSeatId = progress.currentTurnSeatId;
      const view = service.getMatchView(created.snapshot.code, actingSeatId)!;
      const wildcard = view.yourHand.find((card) => card.isWildcard);

      if (wildcard) {
        service.requestWildcardSelection(
          created.snapshot.code,
          tokenBySeatId.get(actingSeatId),
          wildcard.id,
        );
        service.selectWildcard(
          created.snapshot.code,
          tokenBySeatId.get(actingSeatId),
          wildcard.id,
          '4 de copa',
        );
      }

      const refreshedView = service.getMatchView(
        created.snapshot.code,
        actingSeatId,
      )!;
      service.playCard({
        roomCode: created.snapshot.code,
        roomSessionToken: tokenBySeatId.get(actingSeatId)!,
        cardId: refreshedView.yourHand[0].id,
      });
    }

    const finalSnapshot = service.getSnapshot(created.snapshot.code);
    expect(finalSnapshot.phase).toBe('match_end');
    expect(finalSnapshot.winnerTeamSide).toMatch(/A|B/);

    const summary = service.startSummaryWithResult(
      created.snapshot.code,
      created.session.roomSessionToken,
      'match_end',
    );
    expect(summary.summaryStarted).toBe(true);
    expect(summary.snapshot.phase).toBe('post_match_summary');
    expect(summary.lifecycle.matchView?.summary).toEqual(
      expect.objectContaining({
        winnerTeamSide: expect.stringMatching(/A|B/),
      }),
    );
  });

  it('allows envido over a pending truco before any card is played', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );

    expect(() =>
      service.openCanto(
        created.snapshot.code,
        joined.session.roomSessionToken,
        'envido',
        created.session.seatId,
      ),
    ).not.toThrow();

    const afterEnvidoOpen = service.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );
    expect(afterEnvidoOpen.transitionState?.phaseDetail).toContain('envido');

    service.resolveCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'no_quiero',
    );

    const resumed = service.getRoomLifecycleState(
      created.snapshot.code,
      joined.session.seatId,
    );
    expect(resumed.progressState?.phase).toBe('response_pending');
    expect(resumed.transitionState?.phaseDetail).toContain('truco');

    service.resolveCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'quiero',
    );

    expect(
      service.getMatchView(created.snapshot.code, created.session.seatId)
        ?.currentHandPoints,
    ).toBe(2);
  });

  it('blocks envido over truco once a card was already played in the first trick', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    const hostView = service.getMatchView(
      created.snapshot.code,
      created.session.seatId,
    )!;

    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      cardId: hostView.yourHand[0].id,
    });

    service.openCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'truco',
      created.session.seatId,
    );

    expect(() =>
      service.openCanto(
        created.snapshot.code,
        created.session.roomSessionToken,
        'envido',
        joined.session.seatId,
      ),
    ).toThrow('Cantos can only be opened during an active turn.');
  });

  it('awards tied envido to mano even when the other player called it', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    setHand(service, created.snapshot.code, created.session.seatId, [
      createCard('host-e1', 7, 'oro'),
      createCard('host-e2', 6, 'oro'),
      createCard('host-e3', 4, 'copa'),
    ]);
    setHand(service, created.snapshot.code, joined.session.seatId, [
      createCard('guest-e1', 7, 'espada'),
      createCard('guest-e2', 6, 'espada'),
      createCard('guest-e3', 4, 'basto'),
    ]);

    service.openCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'truco',
      joined.session.seatId,
    );
    service.openCanto(
      created.snapshot.code,
      joined.session.roomSessionToken,
      'envido',
      created.session.seatId,
    );
    service.resolveCanto(
      created.snapshot.code,
      created.session.roomSessionToken,
      'quiero',
    );

    const snapshot = service.getSnapshot(created.snapshot.code);
    expect(snapshot.score).toEqual({ A: 2, B: 0 });
  });

  it('keeps the mano on first-trick ties and rotates the next hand starter', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    setHand(service, created.snapshot.code, created.session.seatId, [
      createCard('host-1', 4, 'copa'),
      createCard('host-2', 1, 'espada'),
      createCard('host-3', 5, 'oro'),
    ]);
    setHand(service, created.snapshot.code, joined.session.seatId, [
      createCard('guest-1', 4, 'oro'),
      createCard('guest-2', 6, 'copa'),
      createCard('guest-3', 7, 'basto'),
    ]);

    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      cardId: 'host-1',
    });
    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: joined.session.roomSessionToken,
      cardId: 'guest-1',
    });

    const afterTie = service.getMatchProgressState(created.snapshot.code)!;
    expect(afterTie.trickNumber).toBe(2);
    expect(afterTie.currentTurnSeatId).toBe(created.session.seatId);
    expect(afterTie.resolvedTricks[0]).toEqual(
      expect.objectContaining({
        trickNumber: 1,
        winnerSeatId: null,
        winnerTeamSide: null,
      }),
    );

    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      cardId: 'host-2',
    });
    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: joined.session.roomSessionToken,
      cardId: 'guest-2',
    });

    const nextHand = service.getMatchProgressState(created.snapshot.code)!;
    expect(nextHand.handNumber).toBe(2);
    expect(nextHand.trickNumber).toBe(1);
    expect(nextHand.currentTurnSeatId).toBe(joined.session.seatId);
    expect(nextHand.score).toEqual({ A: 1, B: 0 });
  });

  it('awards the hand to the first-trick winner when the third trick ties after 1-1', async () => {
    const created = service.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
      targetScore: 30,
    });
    const joined = await service.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    service.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    service.toggleReady(created.snapshot.code, joined.session.roomSessionToken);
    service.startMatch(created.snapshot.code, created.session.roomSessionToken);

    setHand(service, created.snapshot.code, created.session.seatId, [
      createCard('host-a', 1, 'espada'),
      createCard('host-b', 4, 'copa'),
      createCard('host-c', 5, 'oro'),
    ]);
    setHand(service, created.snapshot.code, joined.session.seatId, [
      createCard('guest-a', 7, 'oro'),
      createCard('guest-b', 1, 'basto'),
      createCard('guest-c', 5, 'copa'),
    ]);

    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      cardId: 'host-a',
    });
    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: joined.session.roomSessionToken,
      cardId: 'guest-a',
    });
    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      cardId: 'host-b',
    });
    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: joined.session.roomSessionToken,
      cardId: 'guest-b',
    });
    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: joined.session.roomSessionToken,
      cardId: 'guest-c',
    });
    service.playCard({
      roomCode: created.snapshot.code,
      roomSessionToken: created.session.roomSessionToken,
      cardId: 'host-c',
    });

    const progress = service.getMatchProgressState(created.snapshot.code)!;
    expect(progress.handNumber).toBe(2);
    expect(progress.score).toEqual({ A: 1, B: 0 });
  });
});
