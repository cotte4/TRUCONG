import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { GameGateway } from './game.gateway';
import { RoomStoreService } from './rooms/room-store.service';

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

async function createRoomStoreService() {
  const paramTypes: unknown[] =
    (Reflect.getMetadata('design:paramtypes', RoomStoreService) as unknown[]) ??
    [];

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

describe('GameGateway', () => {
  let roomStore: RoomStoreService;
  let gateway: GameGateway;

  beforeEach(async () => {
    roomStore = await createRoomStoreService();
    gateway = new GameGateway(roomStore);
  });

  it('emits a personalized room update for each connected seat', async () => {
    const created = roomStore.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await roomStore.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    roomStore.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    roomStore.toggleReady(
      created.snapshot.code,
      joined.session.roomSessionToken,
    );
    roomStore.startMatch(
      created.snapshot.code,
      created.session.roomSessionToken,
    );

    const snapshot = roomStore.getSnapshot(created.snapshot.code);
    const lifecycle = roomStore.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );
    const baseEvent = gateway['buildRoomUpdatedEvent'](
      created.snapshot.code,
      created.session.roomSessionToken,
      'test broadcast',
      lifecycle,
      snapshot,
    );

    const emissions = new Map<
      string,
      Array<{ event: string; payload: unknown }>
    >();
    const fakeServer = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([
          { id: 'socket-host', data: { seatId: created.session.seatId } },
          { id: 'socket-guest', data: { seatId: joined.session.seatId } },
        ]),
      }),
      to: jest.fn((target: string) => ({
        emit: (event: string, payload: unknown) => {
          const current = emissions.get(target) ?? [];
          current.push({ event, payload });
          emissions.set(target, current);
        },
      })),
    };

    gateway.server = fakeServer as never;

    await gateway['emitRoomState'](
      created.snapshot.code,
      snapshot,
      baseEvent,
      null,
    );

    const hostRoomUpdated = emissions
      .get('socket-host')
      ?.find((entry) => entry.event === 'room:updated')?.payload as {
      matchView: ReturnType<RoomStoreService['getMatchView']>;
    };
    const guestRoomUpdated = emissions
      .get('socket-guest')
      ?.find((entry) => entry.event === 'room:updated')?.payload as {
      matchView: ReturnType<RoomStoreService['getMatchView']>;
    };

    expect(hostRoomUpdated.matchView?.yourHand).toEqual(
      roomStore.getMatchView(created.snapshot.code, created.session.seatId)
        ?.yourHand,
    );
    expect(guestRoomUpdated.matchView?.yourHand).toEqual(
      roomStore.getMatchView(created.snapshot.code, joined.session.seatId)
        ?.yourHand,
    );
    expect(hostRoomUpdated.matchView?.yourHand).not.toEqual(
      guestRoomUpdated.matchView?.yourHand,
    );
  });

  it('includes personalized match payloads when emitting room patches', async () => {
    const created = roomStore.createRoom({
      displayName: 'Host',
      maxPlayers: 2,
    });
    const joined = await roomStore.joinRoom(created.snapshot.code, {
      displayName: 'Guest',
    });

    roomStore.toggleReady(
      created.snapshot.code,
      created.session.roomSessionToken,
    );
    roomStore.toggleReady(
      created.snapshot.code,
      joined.session.roomSessionToken,
    );
    roomStore.startMatch(
      created.snapshot.code,
      created.session.roomSessionToken,
    );

    const snapshot = roomStore.getSnapshot(created.snapshot.code);
    const lifecycle = roomStore.getRoomLifecycleState(
      created.snapshot.code,
      created.session.seatId,
    );
    const baseEvent = gateway['buildRoomUpdatedEvent'](
      created.snapshot.code,
      created.session.roomSessionToken,
      'test patch',
      lifecycle,
      snapshot,
    );

    const emissions = new Map<
      string,
      Array<{ event: string; payload: unknown }>
    >();
    const fakeServer = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([
          { id: 'socket-host', data: { seatId: created.session.seatId } },
          { id: 'socket-guest', data: { seatId: joined.session.seatId } },
        ]),
      }),
      to: jest.fn((target: string) => ({
        emit: (event: string, payload: unknown) => {
          const current = emissions.get(target) ?? [];
          current.push({ event, payload });
          emissions.set(target, current);
        },
      })),
    };

    gateway.server = fakeServer as never;

    gateway['lastSnapshotBySocket'].set('socket-host', {
      ...snapshot,
      stateVersion: snapshot.stateVersion - 1,
    });
    gateway['lastSnapshotBySocket'].set('socket-guest', {
      ...snapshot,
      stateVersion: snapshot.stateVersion - 1,
    });

    await gateway['emitRoomState'](
      created.snapshot.code,
      snapshot,
      baseEvent,
      null,
    );

    const hostPatch = emissions
      .get('socket-host')
      ?.find((entry) => entry.event === 'room:patch')?.payload as {
      matchView: ReturnType<RoomStoreService['getMatchView']>;
      stateVersion: number;
    };
    const guestPatch = emissions
      .get('socket-guest')
      ?.find((entry) => entry.event === 'room:patch')?.payload as {
      matchView: ReturnType<RoomStoreService['getMatchView']>;
      stateVersion: number;
    };

    expect(hostPatch.stateVersion).toBe(snapshot.stateVersion);
    expect(hostPatch.matchView?.yourHand).toEqual(
      roomStore.getMatchView(created.snapshot.code, created.session.seatId)
        ?.yourHand,
    );
    expect(guestPatch.matchView?.yourHand).toEqual(
      roomStore.getMatchView(created.snapshot.code, joined.session.seatId)
        ?.yourHand,
    );
    expect(hostPatch.matchView?.yourHand).not.toEqual(
      guestPatch.matchView?.yourHand,
    );
  });
});
