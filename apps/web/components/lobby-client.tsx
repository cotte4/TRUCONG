"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  CantoOpenPayload,
  CantoType,
  DetailedWildcardSelectionState,
  LobbyActionPayload,
  LobbyTeamPayload,
  MatchProgressState,
  MatchTransitionState,
  MatchView,
  PlayCardPayload,
  ResumeRoomResponse,
  RoomSession,
  RoomSnapshot,
  SummaryStartPayload,
  TeamSide,
  WildcardSelectPayload,
} from "@dimadong/contracts";
import { apiBaseUrl, socketBaseUrl } from "@/lib/config";

function getSessionStorageKey(code: string) {
  return `dimadong:${code}:session`;
}

function formatPhase(phase: RoomSnapshot["phase"]) {
  switch (phase) {
    case "lobby":
      return "Sala";
    case "ready_check":
      return "Chequeo de listos";
    case "dealing":
      return "Repartiendo";
    case "action_turn":
      return "Juego";
    case "canto_pending":
      return "Canto pendiente";
    case "response_pending":
      return "Respuesta pendiente";
    case "wildcard_selection":
      return "Comodín";
    case "trick_resolution":
      return "Resolviendo baza";
    case "hand_scoring":
      return "Contando mano";
    case "reconnect_hold":
      return "Reconexión";
    case "match_end":
      return "Fin de partida";
    case "post_match_summary":
      return "Resumen";
    default:
      return phase;
  }
}

function formatClock(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString("es-AR", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function badgeClass(active?: boolean) {
  return active
    ? "border-cyan-300/40 bg-cyan-300/12 text-cyan-100"
    : "border-white/10 bg-white/5 text-slate-300";
}

function panelClass(extra = "") {
  return `rounded-[1.75rem] border border-white/10 bg-slate-950/78 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.28)] ${extra}`.trim();
}

function getFanTransform(index: number, total: number) {
  const center = (total - 1) / 2;
  const offset = index - center;
  const rotate = offset * 6;
  const translateY = Math.abs(offset) * 10;
  const translateX = offset * 10;

  return `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg)`;
}

type RealtimePayload = {
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition?: MatchTransitionState | null;
  wildcardSelection?: DetailedWildcardSelectionState | null;
  session?: RoomSession | null;
};

type AlienTone = "green" | "red" | "white" | "cyan";

function getAlienTone(seat: RoomSnapshot["seats"][number], index: number): AlienTone {
  if (seat.teamSide === "A") {
    return index % 2 === 0 ? "green" : "cyan";
  }

  if (seat.teamSide === "B") {
    return index % 2 === 0 ? "red" : "white";
  }

  return (["green", "red", "white", "cyan"] as AlienTone[])[index % 4];
}

function toneClasses(tone: AlienTone) {
  switch (tone) {
    case "green":
      return {
        glow: "shadow-[0_0_35px_rgba(109,255,61,0.26)]",
        panel: "border-lime-300/30 bg-lime-300/10",
        head: "bg-[#69ff3d]",
        ring: "border-lime-200/40 bg-lime-200/10 text-lime-50",
      };
    case "red":
      return {
        glow: "shadow-[0_0_35px_rgba(255,86,106,0.26)]",
        panel: "border-rose-300/30 bg-rose-300/10",
        head: "bg-[#ff445d]",
        ring: "border-rose-200/40 bg-rose-200/10 text-rose-50",
      };
    case "white":
      return {
        glow: "shadow-[0_0_35px_rgba(255,255,255,0.2)]",
        panel: "border-slate-200/20 bg-slate-100/10",
        head: "bg-[#f6f7fb]",
        ring: "border-slate-200/30 bg-slate-100/10 text-slate-100",
      };
    case "cyan":
    default:
      return {
        glow: "shadow-[0_0_35px_rgba(83,234,253,0.26)]",
        panel: "border-cyan-300/30 bg-cyan-300/10",
        head: "bg-[#53eafd]",
        ring: "border-cyan-200/40 bg-cyan-200/10 text-cyan-50",
      };
  }
}

function AlienPilot({
  tone,
  active = false,
}: {
  tone: AlienTone;
  active?: boolean;
}) {
  const palette = toneClasses(tone);

  return (
    <div className={`relative h-20 w-16 shrink-0 ${active ? "scale-110 alien-bob" : ""} transition`}>
      {active ? <div className="absolute inset-x-2 -top-1 h-14 rounded-full bg-cyan-300/20 blur-xl" /> : null}
      <div className={`absolute left-1/2 top-0 h-11 w-11 -translate-x-1/2 rounded-full border-2 border-slate-950/60 ${palette.head}`} />
      <div className="absolute left-[9px] top-4 h-5 w-3 rounded-full bg-black" />
      <div className="absolute right-[9px] top-4 h-5 w-3 rounded-full bg-black" />
      <div className="absolute left-[10px] top-1 h-4 w-[2px] -rotate-25 rounded-full bg-slate-300" />
      <div className="absolute right-[10px] top-1 h-4 w-[2px] rotate-25 rounded-full bg-slate-300" />
      <div className="absolute left-1/2 top-10 h-9 w-8 -translate-x-1/2 rounded-[14px] bg-[#f6f7fb]" />
      <div className="absolute left-2 top-[45px] h-7 w-2 rotate-18 rounded-full bg-[#f6f7fb]" />
      <div className="absolute right-2 top-[45px] h-7 w-2 -rotate-18 rounded-full bg-[#f6f7fb]" />
      <div className="absolute left-[18px] top-[66px] h-10 w-2 rotate-6 rounded-full bg-[#f6f7fb]" />
      <div className="absolute right-[18px] top-[66px] h-10 w-2 -rotate-6 rounded-full bg-[#f6f7fb]" />
    </div>
  );
}

function AlienCardSprite({
  label,
  subtitle,
  tone,
  disabled = false,
  active = false,
  onClick,
}: {
  label: string;
  subtitle: string;
  tone: AlienTone;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const palette = toneClasses(tone);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0d1326] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-[#111936] disabled:cursor-not-allowed disabled:opacity-60 ${palette.glow} ${active ? "border-cyan-200/40 ring-2 ring-cyan-300/20" : ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/10 to-transparent" />
      <div className={`absolute inset-x-3 bottom-2 h-8 rounded-full blur-xl ${tone === "red" ? "bg-rose-300/15" : tone === "green" ? "bg-lime-300/15" : tone === "white" ? "bg-white/10" : "bg-cyan-300/15"}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{label}</p>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${palette.ring}`}>
          Sprite
        </div>
      </div>
      <div className="relative mt-4 flex items-end justify-between">
        <AlienPilot tone={tone} />
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
          Carta
        </div>
      </div>
    </button>
  );
}

export function LobbyClient({ code }: { code: string }) {
  const normalizedCode = useMemo(() => code.toUpperCase(), [code]);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [matchView, setMatchView] = useState<MatchView | null>(null);
  const [matchState, setMatchState] = useState<MatchProgressState | null>(null);
  const [transition, setTransition] = useState<MatchTransitionState | null>(null);
  const [wildcardSelection, setWildcardSelection] = useState<DetailedWildcardSelectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomSessionToken, setRoomSessionToken] = useState<string | null>(null);
  const [connectionLabel, setConnectionLabel] = useState("Conectando...");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const token = window.localStorage.getItem(getSessionStorageKey(normalizedCode));
    setRoomSessionToken(token);

    if (!token) {
      setError("Este navegador todavía no tiene un asiento guardado para esta sala. Entrá desde inicio primero.");
      setLoading(false);
      return;
    }

    let activeSocket: Socket | null = null;

    const syncRoomState = ({
      snapshot: nextSnapshot,
      matchView: nextMatchView,
      state: nextState,
      transition: nextTransition,
      wildcardSelection: nextWildcardSelection,
      session: nextSession,
    }: RealtimePayload) => {
      setSnapshot(nextSnapshot);
      setMatchView(nextMatchView);
      setMatchState(nextState);
      setTransition(nextTransition ?? null);
      setWildcardSelection(nextWildcardSelection ?? null);
      if (typeof nextSession !== "undefined") {
        setSession(nextSession);
      }
      setError(null);
      setLoading(false);
    };

    const refreshRoomState = async () => {
      setConnectionLabel("Sincronizando...");
      const response = await fetch(
        `${apiBaseUrl}/rooms/${normalizedCode}?roomSessionToken=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
          const json = JSON.parse(text) as { message?: string };
          if (typeof json?.message === 'string') message = json.message;
        } catch { /* not JSON, use raw text */ }
        throw new Error(message || "Error al sincronizar la sala.");
      }

      const result = (await response.json()) as ResumeRoomResponse;
      syncRoomState({
        snapshot: result.snapshot,
        matchView: result.matchView,
        state: result.state,
        transition: result.transition,
        wildcardSelection: result.wildcardSelection,
        session: result.session,
      });
    };

    const hydrateRoom = async () => {
      try {
        await refreshRoomState();

        activeSocket = io(`${socketBaseUrl}/game`, {
          transports: ["websocket"],
        });
        setSocket(activeSocket);

        activeSocket.on("connect", () => {
          setConnectionLabel("En vivo");
          activeSocket?.emit("room:join", {
            roomCode: normalizedCode,
            roomSessionToken: token,
          });
        });

        activeSocket.on("disconnect", () => {
          setConnectionLabel("Reconectando...");
        });

        activeSocket.on("connect_error", () => {
          setConnectionLabel("Desconectado");
        });

        const handleRealtimePayload = (payload: RealtimePayload) => {
          syncRoomState(payload);
        };

        activeSocket.on("room:joined", handleRealtimePayload);
        activeSocket.on("room:updated", handleRealtimePayload);
        activeSocket.on("session:recovered", handleRealtimePayload);
        activeSocket.on("action:submitted", handleRealtimePayload);
        activeSocket.on("action:rejected", handleRealtimePayload);
        activeSocket.on("canto:opened", handleRealtimePayload);
        activeSocket.on("canto:resolved", handleRealtimePayload);
        activeSocket.on("wildcard:selection-required", handleRealtimePayload);
        activeSocket.on("wildcard:selected", handleRealtimePayload);
        activeSocket.on("trick:resolved", handleRealtimePayload);
        activeSocket.on("hand:scored", handleRealtimePayload);
        activeSocket.on("summary:started", handleRealtimePayload);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar la sala.");
        setLoading(false);
      }
    };

    void hydrateRoom();

    return () => {
      setSocket(null);
      activeSocket?.disconnect();
    };
  }, [normalizedCode, reloadNonce]);

  const emitWithAck = async <TPayload,>(eventName: string, payload: TPayload) => {
    if (!socket) {
      throw new Error("La conexión en tiempo real todavía no está lista.");
    }

    return new Promise<{ ok: boolean; message?: string }>((resolve) => {
      socket.emit(eventName, payload, (response: { ok: boolean; message?: string }) => {
        resolve(response);
      });
    });
  };

  const runSocketAction = async <TPayload,>(eventName: string, payload: TPayload) => {
    setError(null);
    setActionPending(true);

    try {
      const response = await emitWithAck(eventName, payload);
      if (!response.ok) {
        throw new Error(response.message ?? "La acción falló.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "La acción falló.");
    } finally {
      setActionPending(false);
    }
  };

  const retryRoomLoad = () => {
    setError(null);
    setLoading(true);
    setReloadNonce((value) => value + 1);
  };

  if (loading) {
    return (
      <section className={panelClass("space-y-3")}>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Cargando sala</p>
        <h2 className="text-2xl font-semibold text-white">{normalizedCode}</h2>
        <p className="text-sm text-slate-300">Estamos recuperando tu asiento guardado y sincronizando la mesa.</p>
        <button
          type="button"
          onClick={retryRoomLoad}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Reintentar
        </button>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className={panelClass("space-y-3 border-rose-300/20")}>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-200/70">Sala no disponible</p>
        <h2 className="text-2xl font-semibold text-white">{normalizedCode}</h2>
        <p className="text-sm text-slate-300">{error}</p>
        <div className="flex flex-wrap gap-3">
          {roomSessionToken ? (
            <button
              type="button"
              onClick={retryRoomLoad}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
            >
              Reintentar
            </button>
          ) : null}
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Ir al inicio
          </Link>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  const currentSeat = session ? snapshot.seats.find((seat) => seat.id === session.seatId) ?? null : null;
  const isHost = currentSeat?.id === snapshot.hostSeatId;
  const filledSeats = snapshot.seats.filter((seat) => seat.displayName);
  const everybodyReady = filledSeats.length === snapshot.maxPlayers && filledSeats.every((seat) => seat.isReady);
  const teamA = filledSeats.filter((seat) => seat.teamSide === "A").length;
  const teamB = filledSeats.filter((seat) => seat.teamSide === "B").length;
  const teamsBalanced =
    snapshot.maxPlayers === 2 ? teamA === 1 && teamB === 1 : teamA === 2 && teamB === 2;

  const actorPayload: LobbyActionPayload | null = session
      ? {
        roomCode: normalizedCode,
        roomSessionToken: session.roomSessionToken,
      }
    : null;

  const handleToggleReady = async () => {
    if (!actorPayload) {
      return;
    }
    await runSocketAction("lobby:toggle-ready", actorPayload);
  };

  const handleStart = async () => {
    if (!actorPayload) {
      return;
    }
    await runSocketAction("match:start", actorPayload);
  };

  const handleSetTeam = async (targetSeatId: string, teamSide: TeamSide) => {
    if (!session) {
      return;
    }
    const payload: LobbyTeamPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      targetSeatId,
      teamSide,
    };
    await runSocketAction("lobby:set-team", payload);
  };

  const handlePlayCard = async (cardId: string) => {
    if (!session) {
      return;
    }
    const payload: PlayCardPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      cardId,
    };
    await runSocketAction("game:play-card", payload);
  };

  const handleOpenCanto = async (cantoType: CantoType) => {
    if (!session) {
      return;
    }
    const payload: CantoOpenPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      clientActionId: crypto.randomUUID(),
      cantoType,
    };
    await runSocketAction("canto:open", payload);
  };

  const handleSelectWildcard = async (selectedLabel: string) => {
    if (!session || !wildcardSelection) {
      return;
    }
    const payload: WildcardSelectPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      clientActionId: crypto.randomUUID(),
      cardId: wildcardSelection.cardId,
      selectedLabel,
    };
    await runSocketAction("wildcard:select", payload);
  };

  const handleOpenSummary = async () => {
    if (!session) {
      return;
    }
    const payload: SummaryStartPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      clientActionId: crypto.randomUUID(),
      source: "manual",
    };
    await runSocketAction("summary:start", payload);
  };

  const phase = matchState?.phase ?? snapshot.phase;
  const phaseLabel = formatPhase(phase);
  const score = matchView?.score ?? matchState?.score ?? snapshot.score;
  const statusText =
    transition?.phaseDetail ??
    matchView?.statusText ??
    matchState?.statusText ??
    snapshot.statusText ??
    "Esperando la próxima jugada.";
  const activeSeatId =
    transition?.activeActionSeatId ??
    matchView?.currentTurnSeatId ??
    matchState?.currentTurnSeatId ??
    null;
  const isLobby = phase === "lobby" || phase === "ready_check";
  const isLive = connectionLabel === "En vivo";
  const isMyTurn = phase === "action_turn" && activeSeatId === currentSeat?.id && isLive;
  const needsWildcardSelection =
    wildcardSelection?.isPending === true && wildcardSelection.ownerSeatId === currentSeat?.id;
  const finalSummary =
    matchView?.summary ??
    (transition?.matchSummary.finalScore && transition?.matchSummary.winnerTeamSide
      ? {
          finalScore: transition.matchSummary.finalScore,
          winnerTeamSide: transition.matchSummary.winnerTeamSide,
        }
      : null);

  return (
    <div className="space-y-6">
      <section className={panelClass()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Sala</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{snapshot.code}</h1>
            <p className="max-w-2xl text-sm text-slate-300">{statusText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClass()}`}>
              {connectionLabel}
            </span>
            <span className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClass()}`}>
              {phaseLabel}
            </span>
          </div>
        </div>

        {error ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3">
            <p className="text-sm text-rose-50">{error}</p>
            <button
              type="button"
              onClick={retryRoomLoad}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Reintentar
            </button>
          </div>
        ) : null}
      </section>

      {isLobby ? (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className={`${panelClass()} overflow-hidden`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Previa</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Mesa alien lista para despegar</h2>
              </div>
              <span className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClass(everybodyReady)}`}>
                {filledSeats.length}/{snapshot.maxPlayers} sentados
              </span>
            </div>

            <div className="relative mt-8 min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(83,234,253,0.16),transparent_24%),linear-gradient(180deg,#0b1120_0%,#09101d_100%)]">
              <div className="ufo-pulse absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_center,rgba(83,234,253,0.2),rgba(13,19,38,0.96)_58%,rgba(9,16,29,1)_100%)] shadow-[0_0_70px_rgba(83,234,253,0.18)]" />
              <div className="absolute left-1/2 top-1/2 h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(255,212,54,0.12),rgba(6,11,24,0.82)_62%,rgba(6,11,24,0)_100%)]" />
              <div className="absolute left-1/2 top-1/2 flex w-[220px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Sala {snapshot.code}</p>
                <p className="mt-3 text-2xl font-semibold text-white">Plato volador</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Acá van a caer las cartas cuando arranque la mano.
                </p>
              </div>

              {snapshot.seats.map((seat) => {
                const tone = getAlienTone(seat, seat.seatIndex);
                const palette = toneClasses(tone);
                const isCurrentSeat = seat.id === currentSeat?.id;
                const positions =
                  snapshot.maxPlayers === 2
                    ? [
                        "left-1/2 top-6 -translate-x-1/2",
                        "left-1/2 bottom-6 -translate-x-1/2",
                      ]
                    : [
                        "left-1/2 top-6 -translate-x-1/2",
                        "right-6 top-1/2 -translate-y-1/2",
                        "left-1/2 bottom-6 -translate-x-1/2",
                        "left-6 top-1/2 -translate-y-1/2",
                      ];

                return (
                  <div key={seat.id} className={`absolute ${positions[seat.seatIndex] ?? ""}`}>
                    {isCurrentSeat ? <div className="alien-beam absolute left-1/2 top-12 h-28 w-20 -translate-x-1/2 rounded-full bg-cyan-300/12 blur-xl" /> : null}
                    <div className={`w-44 rounded-[1.6rem] border bg-[#0c1326]/92 px-4 py-4 ${palette.panel} ${palette.glow}`}>
                      <div className="flex items-center gap-3">
                        <AlienPilot tone={tone} active={isCurrentSeat} />
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {seat.displayName ?? "Asiento libre"}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {seat.teamSide ? `Equipo ${seat.teamSide}` : "Esperando"}
                          </p>
                          <p className="mt-2 text-sm text-slate-300">
                            {seat.displayName
                              ? isCurrentSeat
                                ? seat.isReady ? "Vos, listo para jugar." : "Vos, falta marcar listo."
                                : seat.isReady
                                  ? "Listo para arrancar."
                                  : "Todavía no está listo."
                              : "Disponible para entrar."}
                          </p>
                        </div>
                      </div>

                      {isHost && seat.displayName ? (
                        <div className="mt-4 flex gap-2">
                          {(["A", "B"] as TeamSide[]).map((teamSide) => (
                            <button
                              key={teamSide}
                              type="button"
                              disabled={actionPending}
                              onClick={() => handleSetTeam(seat.id, teamSide)}
                              className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                                seat.teamSide === teamSide
                                  ? "bg-white text-slate-950"
                                  : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              Equipo {teamSide}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className={`${panelClass("space-y-5")} border-amber-200/20 bg-[#121827]/88`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/70">Cabina</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Chequeo previo al despegue</h2>
            </div>

            <div className="grid gap-3">
              {[
                `Modo: ${snapshot.maxPlayers === 2 ? "1 contra 1" : "2 contra 2"}`,
                `A cuánto: ${snapshot.targetScore} puntos`,
                `Equipos: ${teamsBalanced ? "balanceados" : "faltan acomodar"}`,
                `BONGS: ${snapshot.allowBongs ? "encendidos" : "apagados"}`,
              ].map((item) => (
                <div key={item} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 px-4 py-4 text-sm text-cyan-50">
              Cuando todos estén listos, el OVNI se abre y empieza la mano.
            </div>

            {currentSeat ? (
              <button
                type="button"
                disabled={actionPending}
                onClick={handleToggleReady}
                className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                  currentSeat.isReady
                    ? "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    : "bg-white text-slate-950 hover:bg-slate-200"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {currentSeat.isReady ? "No listo" : "Estoy listo"}
              </button>
            ) : null}

            {isHost ? (
              <button
                type="button"
                disabled={actionPending || !everybodyReady || !teamsBalanced}
                onClick={handleStart}
                className="w-full rounded-full bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Despegar partida
              </button>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="space-y-6">
            <div className={`${panelClass()} overflow-hidden`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Mesa OVNI</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">La mano está en el aire</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300">{statusText}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
                    {score.A} - {score.B}
                  </div>
                  {isMyTurn ? (
                    <div className="rounded-full border border-cyan-300/40 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-50">
                      Te toca
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="relative mt-8 min-h-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(83,234,253,0.14),transparent_22%),linear-gradient(180deg,#0b1020_0%,#09101d_100%)]">
                <div className="ufo-pulse absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_center,rgba(83,234,253,0.22),rgba(12,18,38,0.96)_55%,rgba(8,13,29,1)_100%)] shadow-[0_0_90px_rgba(83,234,253,0.2)]" />
                <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(255,210,54,0.12),rgba(8,13,29,0.1)_70%,transparent_100%)]" />
                {!(matchView?.tableCards?.length) ? (
                  <div className="absolute left-1/2 top-1/2 flex w-[240px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Centro de mando</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{snapshot.code}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Mano {matchView?.handNumber ?? "-"} · Baza {matchView?.trickNumber ?? "-"}
                    </p>
                    {formatClock(matchView?.turnDeadlineAt ?? snapshot.turnDeadlineAt) ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                        Límite {formatClock(matchView?.turnDeadlineAt ?? snapshot.turnDeadlineAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {snapshot.seats.map((seat) => {
                  const tone = getAlienTone(seat, seat.seatIndex);
                  const palette = toneClasses(tone);
                  const isCurrentSeat = seat.id === currentSeat?.id;
                  const isActiveSeat = seat.id === activeSeatId;
                  const positions =
                    snapshot.maxPlayers === 2
                      ? [
                          "left-1/2 top-6 -translate-x-1/2",
                          "left-1/2 bottom-6 -translate-x-1/2",
                        ]
                      : [
                          "left-1/2 top-6 -translate-x-1/2",
                          "right-6 top-1/2 -translate-y-1/2",
                          "left-1/2 bottom-6 -translate-x-1/2",
                          "left-6 top-1/2 -translate-y-1/2",
                        ];

                  return (
                    <div key={seat.id} className={`absolute ${positions[seat.seatIndex] ?? ""}`}>
                      {isActiveSeat ? <div className="alien-beam absolute left-1/2 top-12 h-32 w-24 -translate-x-1/2 rounded-full bg-cyan-300/14 blur-xl" /> : null}
                      <div className={`w-44 rounded-[1.6rem] border bg-[#0c1326]/92 px-4 py-4 ${palette.panel} ${palette.glow}`}>
                        <div className="flex items-center gap-3">
                          <AlienPilot tone={tone} active={isCurrentSeat || isActiveSeat} />
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-white">
                              {seat.displayName ?? `Asiento ${seat.seatIndex + 1}`}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              {seat.teamSide ? `Equipo ${seat.teamSide}` : "Libre"}
                            </p>
                            <p className="mt-2 text-sm text-slate-300">
                              {isActiveSeat
                                ? "Está jugando ahora."
                                : isCurrentSeat
                                  ? "Tu cabina."
                                  : `${seat.handCount} carta(s) en mano.`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(matchView?.tableCards ?? []).map((play, index) => {
                  const seat = snapshot.seats.find((item) => item.id === play.seatId);
                  const tone = seat ? getAlienTone(seat, seat.seatIndex) : "cyan";
                  const positions =
                    snapshot.maxPlayers === 2
                      ? [
                          "left-1/2 top-[170px] -translate-x-1/2 -rotate-3",
                          "left-1/2 bottom-[170px] -translate-x-1/2 rotate-3",
                        ]
                      : [
                          "left-1/2 top-[150px] -translate-x-1/2 -rotate-3",
                          "right-[170px] top-1/2 -translate-y-1/2 rotate-6",
                          "left-1/2 bottom-[150px] -translate-x-1/2 rotate-3",
                          "left-[170px] top-1/2 -translate-y-1/2 -rotate-6",
                        ];

                  return (
                    <div key={`${play.seatId}-${play.card.id}-${index}`} className={`absolute ${positions[seat?.seatIndex ?? index] ?? ""}`}>
                      <div className="relative">
                        <div className="absolute inset-x-5 bottom-0 h-6 rounded-full bg-black/45 blur-xl" />
                        <AlienCardSprite
                          label={play.card.label}
                          subtitle={play.displayName ?? "Mesa"}
                          tone={tone}
                          active
                          disabled
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className={`${panelClass()} border-cyan-300/20 bg-[#11172b]/90`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Tu mano</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {matchView?.yourTeamSide ? `Equipo ${matchView.yourTeamSide}` : "Esperando asiento"}
                  </h2>
                </div>
                {isMyTurn ? (
                  <span className="rounded-full border border-cyan-300/40 bg-cyan-300/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    Te toca
                  </span>
                ) : null}
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 pb-6 pt-4">
                {matchView?.yourHand.length ? (
                  <div className="relative flex min-h-[300px] items-end justify-center">
                    <div className="absolute inset-x-8 bottom-0 h-10 rounded-full bg-black/40 blur-2xl" />
                    {matchView.yourHand.map((card, index) => (
                      <div
                        key={card.id}
                        className="relative -mx-3 w-[190px] shrink-0 transition hover:z-20 hover:-translate-y-4"
                        style={{
                          transform: getFanTransform(index, matchView.yourHand.length),
                          zIndex: index + 1,
                        }}
                      >
                        <AlienCardSprite
                          label={card.label}
                      subtitle={card.isWildcard ? "Comodín alien" : `${card.rank} de ${card.suit}`}
                          tone={getAlienTone(currentSeat ?? snapshot.seats[0], index)}
                          active={isMyTurn}
                          disabled={actionPending || !isMyTurn}
                          onClick={() => handlePlayCard(card.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
                    Tu mano va a aparecer acá después del reparto.
                  </div>
                )}
              </div>

              {phase === "action_turn" && isMyTurn ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {(["truco", "envido"] as CantoType[]).map((cantoType) => (
                    <button
                      key={cantoType}
                      type="button"
                      disabled={actionPending}
                      onClick={() => handleOpenCanto(cantoType)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cantoType === "truco" ? "Cantar truco" : "Cantar envido"}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {needsWildcardSelection ? (
              <div className={panelClass("border-amber-300/20 bg-amber-300/8")}>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/80">Comodín</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Elegí cómo juega.</h2>
                <p className="mt-2 text-sm text-slate-200">
                  {wildcardSelection.fixedForEnvido
                    ? "Este comodín quedó fijado para el envido, así que elegí el valor que va a sostener durante la mano."
                    : "Elegí una de las lecturas habilitadas por el servidor."}
                </p>

                <div className="mt-5 space-y-3">
                  {wildcardSelection.availableChoices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={actionPending}
                      onClick={() => handleSelectWildcard(choice.label)}
                      className="w-full rounded-[1.25rem] border border-white/10 bg-white/[0.05] px-4 py-4 text-left transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <p className="text-base font-semibold text-white">{choice.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {finalSummary ? (
              <div className={panelClass("border-emerald-300/20")}>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/75">Resultado</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Ganó el equipo {finalSummary.winnerTeamSide}.</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Puntaje final {finalSummary.finalScore.A} - {finalSummary.finalScore.B}
                </p>
                {isHost && phase !== "post_match_summary" ? (
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={handleOpenSummary}
                    className="mt-5 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Abrir resumen
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className={panelClass()}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Eventos recientes</p>
              <div className="mt-4 space-y-2">
                {(matchView?.recentEvents ?? snapshot.recentEvents).slice(0, 6).map((event) => (
                  <div key={event} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                    {event}
                  </div>
                ))}
                {(matchView?.recentEvents ?? snapshot.recentEvents).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-400">
                    Todavía no hay eventos.
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
