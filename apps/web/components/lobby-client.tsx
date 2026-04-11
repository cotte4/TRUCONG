"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AvatarId,
  CantoOpenedEvent,
  CantoResolvedEvent,
  CardSuit,
  CardView,
  CantoOpenPayload,
  CantoResolvePayload,
  CantoType,
  ChatReceivedEvent,
  ChatSendPayload,
  DetailedWildcardSelectionState,
  EnvidoSeatDeclaredEvent,
  EnvidoSingingState,
  EnvidoWildcardCommitRequestedEvent,
  HandScoredEvent,
  LobbyActionPayload,
  LobbyTeamPayload,
  MatchProgressState,
  MatchTransitionState,
  MatchView,
  PlayCardPayload,
  ReactionReceivedEvent,
  ReactionSendPayload,
  ResumeRoomResponse,
  RoomSession,
  RoomSnapshot,
  SeatFreePayload,
  SummaryStartedEvent,
  SummaryStartPayload,
  TablePlayView,
  TeamSide,
  TrickResolvedEvent,
  WildcardSelectPayload,
  WildcardSelectedEvent,
  WildcardSelectionRequiredEvent,
} from "@dimadong/contracts";
import { apiBaseUrl, socketBaseUrl } from "@/lib/config";
import { AVATAR_OPTIONS } from "@/lib/avatar-catalog";

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
  const absOffset = Math.abs(offset);

  return `translateX(calc(${offset} * clamp(6px, 1.8vw, 10px))) translateY(calc(${absOffset} * clamp(5px, 1.3vw, 10px))) rotate(calc(${offset} * clamp(2.5deg, 0.9vw, 6deg)))`;
}

function getRelativeSeatOffset(seatIndex: number, anchorSeatIndex: number | null, totalSeats: number) {
  if (anchorSeatIndex === null || totalSeats <= 0) {
    return seatIndex;
  }

  return (seatIndex - anchorSeatIndex + totalSeats) % totalSeats;
}

function getSeatPositionClass(totalSeats: number, relativeOffset: number) {
  if (totalSeats === 2) {
    return relativeOffset === 0
      ? "left-1/2 bottom-6 -translate-x-1/2"
      : "left-1/2 top-6 -translate-x-1/2";
  }

  const positions = [
    "left-1/2 bottom-6 -translate-x-1/2",
    "left-6 top-1/2 -translate-y-1/2",
    "left-1/2 top-6 -translate-x-1/2",
    "right-6 top-1/2 -translate-y-1/2",
  ];

  return positions[relativeOffset] ?? positions[0];
}

function getTableCardStyle(totalSeats: number, relativeOffset: number) {
  if (totalSeats === 2) {
    return relativeOffset === 0
      ? { left: "50%", bottom: "23%", transform: "translateX(-50%) rotate(-3deg)" }
      : { left: "50%", top: "23%", transform: "translateX(-50%) rotate(3deg)" };
  }

  const positions = [
    { left: "50%", bottom: "20%", transform: "translateX(-50%) rotate(-2deg)" },
    { left: "26%", top: "50%", transform: "translateY(-50%) rotate(-7deg)" },
    { left: "50%", top: "20%", transform: "translateX(-50%) rotate(2deg)" },
    { right: "26%", top: "50%", transform: "translateY(-50%) rotate(7deg)" },
  ];

  return positions[relativeOffset] ?? positions[0];
}

type RealtimePayload = {
  snapshot: RoomSnapshot;
  matchView: MatchView | null;
  state: MatchProgressState | null;
  transition?: MatchTransitionState | null;
  wildcardSelection?: DetailedWildcardSelectionState | null;
  envidoSinging?: EnvidoSingingState | null;
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

function resolveAvatarImagePath(avatarId: AvatarId | null | undefined) {
  if (!avatarId) {
    return null;
  }

  return AVATAR_OPTIONS.find((avatar) => avatar.id === avatarId)?.imagePath ?? null;
}

function AvatarCircle({
  avatarId,
  tone,
  active = false,
  size = 40,
}: {
  avatarId: AvatarId | null;
  tone: AlienTone;
  active?: boolean;
  size?: number;
}) {
  const imagePath = resolveAvatarImagePath(avatarId);
  const fallbackBackground =
    tone === "red"
      ? "linear-gradient(140deg, #ff5d72, #7a1d45)"
      : tone === "green"
        ? "linear-gradient(140deg, #9eff4f, #2f6e2a)"
        : tone === "white"
          ? "linear-gradient(140deg, #f8fafc, #9ca3af)"
          : "linear-gradient(140deg, #73f0ff, #146b8a)";

  return (
    <div className={`relative shrink-0 ${active ? "alien-bob" : ""}`} style={{ width: size, height: size }}>
      <div
        className={`relative h-full w-full overflow-hidden rounded-full border-2 border-white/20 ${active ? "shadow-[0_0_28px_rgba(83,234,253,0.65)]" : "shadow-[0_0_18px_rgba(83,234,253,0.24)]"}`}
        style={{
          background: imagePath ? undefined : fallbackBackground,
        }}
      >
        {imagePath ? (
          <Image
            src={imagePath}
            alt="Avatar"
            fill
            className="object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
    </div>
  );
}

type CardArtMode = "watermark" | "hologram";

type SuitVisual = {
  iconPath: string;
  fallback: string;
  edge: string;
  glow: string;
  miniGlow: string;
  miniSizeClass: string;
  centerSizeWatermarkClass: string;
  centerSizeHologramClass: string;
};

const SUIT_VISUALS: Record<CardSuit, SuitVisual> = {
  oro: {
    iconPath: "/cards/suits/oro.png",
    fallback: "O",
    edge: "border-lime-300/55",
    glow: "shadow-[0_0_26px_rgba(196,255,92,0.26)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(224,255,132,0.9)]",
    miniSizeClass: "h-6 w-6",
    centerSizeWatermarkClass: "h-24 w-24",
    centerSizeHologramClass: "h-16 w-16",
  },
  copa: {
    iconPath: "/cards/suits/copa.png",
    fallback: "C",
    edge: "border-violet-300/55",
    glow: "shadow-[0_0_26px_rgba(182,113,255,0.3)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(212,168,255,0.9)]",
    miniSizeClass: "h-5 w-5",
    centerSizeWatermarkClass: "h-20 w-20",
    centerSizeHologramClass: "h-14 w-14",
  },
  espada: {
    iconPath: "/cards/suits/espada.png",
    fallback: "E",
    edge: "border-cyan-300/55",
    glow: "shadow-[0_0_26px_rgba(73,226,255,0.28)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(142,248,255,0.9)]",
    miniSizeClass: "h-6 w-6",
    centerSizeWatermarkClass: "h-24 w-24",
    centerSizeHologramClass: "h-16 w-16",
  },
  basto: {
    iconPath: "/cards/suits/basto.png",
    fallback: "B",
    edge: "border-emerald-300/55",
    glow: "shadow-[0_0_26px_rgba(91,255,142,0.28)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(147,255,181,0.9)]",
    miniSizeClass: "h-6 w-6",
    centerSizeWatermarkClass: "h-23 w-23",
    centerSizeHologramClass: "h-15 w-15",
  },
};

function SuitIcon({
  suit,
  alt,
  className,
}: {
  suit: CardSuit;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const visual = SUIT_VISUALS[suit];

  if (failed) {
    return (
      <span className={`inline-flex items-center justify-center font-bold text-white ${className}`}>
        {visual.fallback}
      </span>
    );
  }

  return (
    <img
      src={visual.iconPath}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function TrucoCardSprite({
  card,
  artMode = "watermark",
  disabled = false,
  active = false,
  onClick,
}: {
  card: CardView;
  subtitle: string;
  artMode?: CardArtMode;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const visual = SUIT_VISUALS[card.suit];
  const cornerRank = card.isWildcard ? "★" : `${card.rank}`;

  const centerSizeClass =
    artMode === "hologram"
      ? visual.centerSizeHologramClass
      : visual.centerSizeWatermarkClass;

  const centerIconClass =
    artMode === "hologram"
      ? `${centerSizeClass} opacity-95 drop-shadow-[0_0_16px_rgba(255,255,255,0.52)]`
      : `${centerSizeClass} opacity-40`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative h-full min-h-[184px] w-full overflow-hidden rounded-[1rem] border bg-[rgba(12,17,34,0.86)] transition disabled:cursor-not-allowed disabled:opacity-55 ${visual.edge} ${active ? `${visual.glow} ring-2 ring-white/15` : "shadow-[inset_0_0_16px_rgba(0,0,0,0.5)]"} ${!disabled ? "hover:-translate-y-0.5 hover:bg-[rgba(15,23,46,0.9)]" : ""}`}
    >
      {/* Gloss overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(165deg,rgba(255,255,255,0.10),transparent_35%)] pointer-events-none" />

      {/* Top-left corner: rank + mini suit icon */}
      <div className="absolute top-2 left-2 flex flex-col items-center gap-1 z-10">
        <span className="text-[1.5rem] font-black leading-none text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
          {cornerRank}
        </span>
        <SuitIcon
          suit={card.suit}
          alt={card.suit}
          className={`h-5 w-5 object-contain ${visual.miniGlow}`}
        />
      </div>

      {/* Center: watermark / hologram suit art */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <SuitIcon suit={card.suit} alt={card.suit} className={centerIconClass} />
      </div>
    </button>
  );
}

type ChatMessage = {
  id: string;
  seatId: string | null;
  message: string;
  sentAt: number;
};

type ActiveReaction = {
  id: string;
  seatId: string | null;
  reaction: string;
  sentAt: number;
};

type ActiveCanto = {
  id: string;
  seatId: string | null;
  cantoType: CantoType;
  sentAt: number;
};

const REACTIONS = ["👽", "🛸", "🔥", "💀", "⚡", "🌟"];
const REACTION_TTL_MS = 4_000;
const SOCKET_ACK_TIMEOUT_MS = 18_000;

function useCountdown(deadlineAt: string | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!deadlineAt) {
      return;
    }

    const tick = () => {
      const ms = new Date(deadlineAt).getTime() - Date.now();
      setSeconds(Math.max(0, Math.ceil(ms / 1000)));
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadlineAt]);

  return deadlineAt === null ? null : seconds;
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recentReactions, setRecentReactions] = useState<ActiveReaction[]>([]);
  const [recentCantos, setRecentCantos] = useState<ActiveCanto[]>([]);
  const [lastTrickCards, setLastTrickCards] = useState<TablePlayView[]>([]);
  const [envidoSinging, setEnvidoSinging] = useState<EnvidoSingingState | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const refreshRoomStateRef = useRef<(() => Promise<void>) | null>(null);

  const turnCountdown = useCountdown(
    (matchState?.phase ?? snapshot?.phase) === "action_turn"
      ? (matchView?.turnDeadlineAt ?? matchState?.turnDeadlineAt ?? snapshot?.turnDeadlineAt ?? null)
      : null
  );
  const reconnectCountdown = useCountdown(
    (matchState?.phase ?? snapshot?.phase) === "reconnect_hold"
      ? (matchView?.reconnectDeadlineAt ?? matchState?.reconnectDeadlineAt ?? snapshot?.reconnectDeadlineAt ?? null)
      : null
  );
  const cantoCountdown = useCountdown(
    (matchState?.phase ?? snapshot?.phase) === "response_pending"
      ? (wildcardSelection?.responseDeadlineAt ?? null)
      : null
  );

  useEffect(() => {
    if (recentReactions.length === 0) return;
    const id = setInterval(() => {
      setRecentReactions((prev) => prev.filter((r) => Date.now() - r.sentAt < REACTION_TTL_MS));
    }, 1_000);
    return () => clearInterval(id);
  }, [recentReactions.length]);

  const CANTO_TTL_MS = 7_000;
  useEffect(() => {
    if (recentCantos.length === 0) return;
    const id = setInterval(() => {
      setRecentCantos((prev) => prev.filter((c) => Date.now() - c.sentAt < CANTO_TTL_MS));
    }, 1_000);
    return () => clearInterval(id);
  }, [recentCantos.length]);

  // Clear saved trick cards when live cards appear (new trick started)
  const liveCardCount = (matchView?.tableCards ?? matchState?.tableCards ?? []).length;
  useEffect(() => {
    if (liveCardCount > 0) setLastTrickCards([]);
  }, [liveCardCount]);

  const currentPhaseForNav = matchState?.phase ?? snapshot?.phase ?? "lobby";
  useEffect(() => {
    if (!["lobby", "ready_check"].includes(currentPhaseForNav)) {
      setNavVisible(false);
    }
  }, [currentPhaseForNav]);

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
      envidoSinging: nextEnvidoSinging,
      session: nextSession,
    }: RealtimePayload) => {
      setSnapshot(nextSnapshot);
      setMatchView(nextMatchView);
      setMatchState(nextState);
      setTransition(nextTransition ?? null);
      setActionPending(false);
      setWildcardSelection(nextWildcardSelection ?? null);
      if (typeof nextEnvidoSinging !== "undefined") {
        setEnvidoSinging(nextEnvidoSinging ?? null);
      }
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
    refreshRoomStateRef.current = refreshRoomState;

    const hydrateRoom = async () => {
      try {
        await refreshRoomState();

        activeSocket = io(`${socketBaseUrl}/game`, {
          transports: ["polling", "websocket"],
          upgrade: true,
          reconnectionDelayMax: 8_000,
        });
        setSocket(activeSocket);

        activeSocket.on("connect", () => {
          setConnectionLabel("Uniéndose...");
          activeSocket?.emit("room:join", {
            roomCode: normalizedCode,
            roomSessionToken: token,
          });
        });

        activeSocket.on("disconnect", () => {
          setConnectionLabel("Reconectando...");
        });

        activeSocket.on("connect_error", () => {
          setConnectionLabel("Reconectando...");
        });

        activeSocket.on("reconnect_attempt", (attempt: number) => {
          setConnectionLabel(`Reconectando… (${attempt})`);
        });

        activeSocket.on("reconnect", () => {
          setConnectionLabel("Uniéndose...");
        });

        activeSocket.on("server:restarting", () => {
          setConnectionLabel("Servidor reiniciando…");
        });

        const handleRealtimePayload = (payload: RealtimePayload) => {
          syncRoomState(payload);
        };

        activeSocket.on("room:joined", (payload: RealtimePayload) => {
          setConnectionLabel("En vivo");
          syncRoomState(payload);
        });
        activeSocket.on("room:updated", handleRealtimePayload);
        activeSocket.on("session:recovered", (payload: RealtimePayload) => {
          setConnectionLabel("En vivo");
          syncRoomState(payload);
        });
        activeSocket.on("chat:received", (event: ChatReceivedEvent) => {
          if (!event.accepted) return;
          setChatMessages((prev) => [
            ...prev.slice(-99),
            { id: event.clientMessageId, seatId: event.seatId, message: event.message, sentAt: Date.now() },
          ]);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        });

        activeSocket.on("reaction:received", (event: ReactionReceivedEvent) => {
          if (!event.accepted) return;
          setRecentReactions((prev) => [
            ...prev.slice(-9),
            { id: event.clientReactionId, seatId: event.seatId, reaction: event.reaction, sentAt: Date.now() },
          ]);
        });

        activeSocket.on("canto:opened", (event: CantoOpenedEvent) => {
          setRecentCantos((prev) => [
            ...prev.slice(-4),
            { id: `${event.seatId}-${event.openedAt}`, seatId: event.seatId, cantoType: event.cantoType, sentAt: Date.now() },
          ]);
          syncRoomState(event);
        });

        activeSocket.on("trick:resolved", (event: TrickResolvedEvent) => {
          if (event.tableCards?.length) {
            setLastTrickCards(event.tableCards);
          }
          syncRoomState(event);
        });

        // Critical: these fire after envido is accepted and carry the updated state.
        // Without these listeners the game freezes after envido is resolved.
        activeSocket.on("envido:seat-declared", (event: EnvidoSeatDeclaredEvent) => {
          setEnvidoSinging(event.singingState);
          syncRoomState(event);
        });

        activeSocket.on("envido:wildcard-commit-required", (event: EnvidoWildcardCommitRequestedEvent) => {
          setEnvidoSinging(event.singingState);
          syncRoomState(event);
        });

        // Critical: canto:resolve does NOT emit room:updated — only canto:resolved.
        // Without this, the game freezes after any quiero/no_quiero (truco, envido, etc.).
        activeSocket.on("canto:resolved", (event: CantoResolvedEvent) => {
          // Clear envido singing once canto is fully resolved
          if (!["envido", "real_envido", "falta_envido"].includes(event.cantoType)) {
            setEnvidoSinging(null);
          }
          syncRoomState(event);
        });

        // Critical: wildcard:request emits only wildcard:selection-required (no room:updated).
        // Without this, the wildcard panel never appears for the requesting player.
        activeSocket.on("wildcard:selection-required", (event: WildcardSelectionRequiredEvent) => {
          setWildcardSelection(event.selection);
          syncRoomState({ ...event, wildcardSelection: event.selection });
        });

        // Critical: wildcard:select emits only wildcard:selected (no room:updated).
        // Without this, state doesn't update after wildcard selection.
        activeSocket.on("wildcard:selected", (event: WildcardSelectedEvent) => {
          syncRoomState({ ...event, wildcardSelection: event.selection });
        });

        // Supplementary: hand:scored fires AFTER room:updated (from play-card), but
        // clear envidoSinging panel when a new hand starts.
        activeSocket.on("hand:scored", (event: HandScoredEvent) => {
          setEnvidoSinging(null);
          syncRoomState(event);
        });

        // Supplementary: summary:started from canto:resolve path has no prior room:updated.
        activeSocket.on("summary:started", (event: SummaryStartedEvent) => {
          setEnvidoSinging(null);
          syncRoomState(event);
        });
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar la sala.");
        setLoading(false);
      }
    };

    void hydrateRoom();

    return () => {
      refreshRoomStateRef.current = null;
      setSocket(null);
      activeSocket?.disconnect();
    };
  }, [normalizedCode, reloadNonce]);

  const emitWithAck = async <TPayload,>(eventName: string, payload: TPayload) => {
    if (!socket) {
      throw new Error("La conexión en tiempo real todavía no está lista.");
    }

    return new Promise<{ ok: boolean; message?: string }>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("La accion tardo demasiado. Revisa tu conexion e intenta de nuevo."));
      }, SOCKET_ACK_TIMEOUT_MS);

      socket.emit(eventName, payload, (response: { ok: boolean; message?: string }) => {
        window.clearTimeout(timeoutId);
        resolve(response);
      });
    });
  };

  const runSocketAction = async <TPayload,>(
    eventName: string,
    payload: TPayload,
    options?: { waitForSync?: boolean },
  ) => {
    setError(null);
    setActionPending(true);

    try {
      const response = await emitWithAck(eventName, payload);
      if (!response.ok) {
        throw new Error(response.message ?? "La acción falló.");
      }
      if (options?.waitForSync === false) {
        setActionPending(false);
      }
      // For stateful gameplay events we keep actionPending until syncRoomState.
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "La acción falló.");
      setActionPending(false);
      void refreshRoomStateRef.current?.();
      return false;
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
  const anchorSeatIndex = currentSeat?.seatIndex ?? null;

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

  const handleResolveCanto = async (
    cantoType: CantoType,
    response: "quiero" | "no_quiero",
  ) => {
    if (!session) return;
    const payload: CantoResolvePayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      clientActionId: crypto.randomUUID(),
      cantoType,
      response,
    };
    await runSocketAction("canto:resolve", payload);
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

  const handleSendChat = async () => {
    if (!session || !chatInput.trim()) return;
    const message = chatInput.trim();
    const payload: ChatSendPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      clientMessageId: crypto.randomUUID(),
      message,
    };
    const sent = await runSocketAction("chat:send", payload, { waitForSync: false });
    if (sent) {
      setChatInput("");
    }
  };

  const handleSendReaction = async (reaction: string) => {
    if (!session) return;
    const payload: ReactionSendPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      clientReactionId: crypto.randomUUID(),
      reaction,
    };
    await runSocketAction("reaction:send", payload, { waitForSync: false });
  };

  const handleFreeSeat = async (targetSeatId: string) => {
    if (!session) return;
    const payload: SeatFreePayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      targetSeatId,
    };
    await runSocketAction("seat:free", payload);
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
    phase === "response_pending"
      ? transition?.activeActionSeatId ?? null
      : matchView?.currentTurnSeatId ??
        matchState?.currentTurnSeatId ??
        transition?.activeActionSeatId ??
        null;
  const isLobby = phase === "lobby" || phase === "ready_check";
  const isLive = connectionLabel === "En vivo";
  const isMyTurn = phase === "action_turn" && activeSeatId === currentSeat?.id && isLive;
  const isMyCantoResponse = phase === "response_pending" && activeSeatId === currentSeat?.id && isLive;
  const pendingCantoType: CantoType | null =
    phase === "response_pending" && transition?.phaseDetail
      ? (transition.phaseDetail.split(" ")[0] as CantoType)
      : null;
  const trickNumber = matchView?.trickNumber ?? matchState?.trickNumber ?? 1;
  const envidoResolved = matchView?.envidoResolved ?? false;
  const trucoOpened = matchView?.trucoOpened ?? false;
  const canCallEnvido = trickNumber === 1 && !trucoOpened && !envidoResolved;
  const needsWildcardSelection =
    wildcardSelection?.isPending === true && wildcardSelection.ownerSeatId === currentSeat?.id;

  const now = Date.now();
  const visibleReactions = recentReactions.filter((r) => now - r.sentAt < REACTION_TTL_MS);
  const visibleCantos = recentCantos.filter((c) => now - c.sentAt < CANTO_TTL_MS);
  // Show last trick's cards when table is empty (between tricks)
  const liveTableCards = matchView?.tableCards ?? matchState?.tableCards ?? [];
  const displayTableCards = liveTableCards.length > 0 ? liveTableCards : lastTrickCards;
  const isShowingLastTrick = liveTableCards.length === 0 && lastTrickCards.length > 0;

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
      {/* Collapsable nav — auto-hides when game starts */}
      {navVisible ? (
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/72 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-xl ufo-pulse inline-block">🛸</span>
            <p className="font-brand-display text-xs text-slate-300">Dimadong</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">
              {normalizedCode}
            </span>
            <Link
              href="/manual"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Cómo se juega
            </Link>
            <Link
              href="/"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Inicio
            </Link>
          </div>
        </nav>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setNavVisible(true)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/72 px-4 py-2 text-sm font-semibold text-slate-300 backdrop-blur transition hover:bg-white/10"
          >
            <span className="ufo-pulse inline-block">🛸</span>
            <span>{normalizedCode}</span>
            <span className="text-xs text-slate-500">▾</span>
          </button>
        </div>
      )}

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

            <div className="ovni-table-surface relative mt-8 min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10">
              <div className="ufo-pulse absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_center,rgba(83,234,253,0.2),rgba(13,19,38,0.96)_58%,rgba(9,16,29,1)_100%)] shadow-[0_0_70px_rgba(83,234,253,0.18)]" />
              <div className="absolute left-1/2 top-1/2 h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(255,212,54,0.12),rgba(6,11,24,0.82)_62%,rgba(6,11,24,0)_100%)]" />
              <div className="absolute left-1/2 top-1/2 flex w-[220px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Sala {snapshot.code}</p>
                <p className="font-brand-display mt-3 text-2xl text-white">Plato volador</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Acá van a caer las cartas cuando arranque la mano.
                </p>
              </div>

              {snapshot.seats.map((seat) => {
                const tone = getAlienTone(seat, seat.seatIndex);
                const palette = toneClasses(tone);
                const isCurrentSeat = seat.id === currentSeat?.id;
                const relativeOffset = getRelativeSeatOffset(
                  seat.seatIndex,
                  anchorSeatIndex,
                  snapshot.maxPlayers,
                );
                const seatReactions = visibleReactions.filter((r) => r.seatId === seat.id).slice(-3);

                return (
                  <div key={seat.id} className={`absolute ${getSeatPositionClass(snapshot.maxPlayers, relativeOffset)}`}>
                    {isCurrentSeat ? <div className="alien-beam absolute left-1/2 top-12 h-28 w-20 -translate-x-1/2 rounded-full bg-cyan-300/12 blur-xl" /> : null}
                    <div className={`w-44 rounded-[1.6rem] border bg-[#0c1326]/92 px-4 py-4 ${palette.panel} ${palette.glow}`}>
                      <div className="flex items-center gap-3">
                          <AvatarCircle avatarId={seat.avatarId} tone={tone} active={isCurrentSeat} size={40} />
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

                      {isHost && seat.displayName && seat.status !== "disconnected" ? (
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
                      {isHost && seat.status === "disconnected" && seat.id !== currentSeat?.id ? (
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => handleFreeSeat(seat.id)}
                          className="mt-4 w-full rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Liberar asiento
                        </button>
                      ) : null}
                      {seatReactions.length > 0 ? (
                        <div className="mt-3 flex justify-center gap-1.5">
                          {seatReactions.map((r) => (
                            <span key={r.id} className="reaction-pop text-2xl leading-none">
                              {r.reaction}
                            </span>
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

            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Chat</p>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin mensajes aún.</p>
                ) : (
                  chatMessages.map((msg) => {
                    const seatName = snapshot.seats.find((s) => s.id === msg.seatId)?.displayName ?? "Anon";
                    const isMe = msg.seatId === currentSeat?.id;
                    return (
                      <div key={msg.id} className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? "border border-cyan-300/20 bg-cyan-300/10 text-cyan-50" : "border border-white/10 bg-white/[0.03] text-slate-200"}`}>
                        <span className="font-semibold">{seatName}: </span>
                        {msg.message}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
              {session ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); void handleSendChat(); }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    maxLength={200}
                    placeholder="Escribí un mensaje…"
                    className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/20"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || actionPending}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Enviar
                  </button>
                </form>
              ) : null}
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="order-2 space-y-6 lg:order-1">
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
                  {isMyTurn && turnCountdown !== null ? (
                    <div className={`rounded-full border px-4 py-2 text-sm font-semibold tabular-nums ${turnCountdown <= 3 ? "border-rose-300/40 bg-rose-300/12 text-rose-50" : "border-cyan-300/40 bg-cyan-300/12 text-cyan-50"}`}>
                      {turnCountdown}s
                    </div>
                  ) : null}
                  {isMyTurn ? (
                    <div className="rounded-full border border-cyan-300/40 bg-cyan-300/12 px-4 py-2 text-sm font-semibold text-cyan-50">
                      Te toca
                    </div>
                  ) : null}
                  {phase === "reconnect_hold" && reconnectCountdown !== null ? (
                    <div className="rounded-full border border-amber-300/40 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-50">
                      Reconectando… {reconnectCountdown}s
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="ovni-table-surface relative mt-8 min-h-[560px] overflow-hidden rounded-[2rem] border border-white/10">
                <div className="ufo-pulse absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_center,rgba(83,234,253,0.22),rgba(12,18,38,0.96)_55%,rgba(8,13,29,1)_100%)] shadow-[0_0_90px_rgba(83,234,253,0.2)]" />
                <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(255,210,54,0.12),rgba(8,13,29,0.1)_70%,transparent_100%)]" />
                {displayTableCards.length === 0 ? (
                  <div className="absolute left-1/2 top-1/2 flex w-[240px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                    <p className="font-brand-display text-2xl text-white">
                      Mano {matchView?.handNumber ?? "-"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400 uppercase tracking-[0.2em]">
                      Baza {matchView?.trickNumber ?? "-"}
                    </p>
                  </div>
                ) : null}

                {snapshot.seats.map((seat) => {
                  const tone = getAlienTone(seat, seat.seatIndex);
                  const palette = toneClasses(tone);
                  const isCurrentSeat = seat.id === currentSeat?.id;
                  const isActiveSeat = seat.id === activeSeatId;
                  const relativeOffset = getRelativeSeatOffset(
                    seat.seatIndex,
                    anchorSeatIndex,
                    snapshot.maxPlayers,
                  );

                  const seatCantos = visibleCantos.filter((c) => c.seatId === seat.id).slice(-2);

                  return (
                    <div key={seat.id} className={`absolute ${getSeatPositionClass(snapshot.maxPlayers, relativeOffset)}`}>
                      {isActiveSeat ? <div className="alien-beam absolute left-1/2 top-12 h-32 w-24 -translate-x-1/2 rounded-full bg-cyan-300/18 blur-xl" /> : null}
                      <div className={`w-44 rounded-[1.6rem] border bg-[#0c1326]/92 px-4 py-4 transition-all duration-300 ${palette.panel} ${isActiveSeat ? "shadow-[0_0_0_3px_rgba(83,234,253,0.55),0_0_32px_rgba(83,234,253,0.3)] scale-[1.04]" : palette.glow}`}>
                        {isActiveSeat ? (
                          <div className="mb-2 flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 w-fit">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">
                              {seat.id === currentSeat?.id ? "Tu turno" : "Jugando"}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-3">
                          <AvatarCircle avatarId={seat.avatarId} tone={tone} active={isCurrentSeat || isActiveSeat} size={40} />
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-white">
                              {seat.displayName ?? `Asiento ${seat.seatIndex + 1}`}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              {seat.teamSide ? `Equipo ${seat.teamSide}` : "Libre"}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              {isActiveSeat
                                ? isCurrentSeat ? "Jugá tu carta." : "Pensando..."
                                : `${seat.handCount} carta(s)`}
                            </p>
                          </div>
                        </div>
                        {seatCantos.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {seatCantos.map((c) => (
                              <div key={c.id} className="reaction-pop flex items-center gap-1.5 rounded-xl border border-violet-300/30 bg-violet-300/10 px-2.5 py-1">
                                <span className="text-base leading-none">
                                  {c.cantoType === "truco" ? "⚔️" : c.cantoType === "retruco" ? "⚔️⚔️" : c.cantoType === "vale_cuatro" ? "⚔️⚔️⚔️" : "🃏"}
                                </span>
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-violet-200">
                                  {c.cantoType === "truco" ? "Truco" : c.cantoType === "retruco" ? "Retruco" : c.cantoType === "vale_cuatro" ? "Vale 4" : c.cantoType === "envido" ? "Envido" : c.cantoType === "real_envido" ? "Real Envido" : "Falta Envido"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {displayTableCards.length > 0 ? (
                  <div className={`absolute inset-0 transition-opacity duration-500 ${isShowingLastTrick ? "opacity-40" : "opacity-100"}`}>
                    {displayTableCards.map((play, index) => {
                      const seat = snapshot.seats.find((item) => item.id === play.seatId);
                      const relativeOffset = getRelativeSeatOffset(
                        seat?.seatIndex ?? index,
                        anchorSeatIndex,
                        snapshot.maxPlayers,
                      );

                      return (
                        <div
                          key={`${play.seatId}-${play.card.id}-${index}`}
                          className="absolute shrink-0"
                          style={{
                            ...getTableCardStyle(snapshot.maxPlayers, relativeOffset),
                            width: "clamp(120px, 22vw, 160px)",
                          }}
                        >
                          <div className="absolute inset-x-5 bottom-0 h-6 rounded-full bg-black/45 blur-xl" />
                          <TrucoCardSprite
                            card={play.card}
                            subtitle={play.displayName ?? "Mesa"}
                            artMode="hologram"
                            active={!isShowingLastTrick}
                            disabled
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="order-1 space-y-6 lg:order-2">
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

              <div className="mt-5 overflow-x-auto overflow-y-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 pb-6 pt-4 sm:px-4">
                {matchView?.yourHand.length ? (
                  <div className="relative flex min-h-[280px] min-w-max items-end justify-center sm:min-h-[300px]">
                    <div className="absolute inset-x-8 bottom-0 h-10 rounded-full bg-black/40 blur-2xl" />
                    {matchView.yourHand.map((card, index) => (
                      <div
                        key={card.id}
                        className="relative -mx-2 sm:-mx-3 shrink-0 transition md:hover:z-20 md:hover:-translate-y-4"
                        style={{
                          transform: getFanTransform(index, matchView.yourHand.length),
                          zIndex: index + 1,
                          width: "clamp(132px, 34vw, 190px)",
                        }}
                      >
                        <TrucoCardSprite
                          card={card}
                          subtitle={card.isWildcard ? "Comodin alien" : `${card.rank} de ${card.suit}`}
                          artMode={isMyTurn ? "hologram" : "watermark"}
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
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => handleOpenCanto("truco")}
                    className="canto-action-btn canto-action-btn-truco"
                  >
                    Truco
                  </button>
                  {canCallEnvido ? (
                    <>
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() => handleOpenCanto("envido")}
                        className="canto-action-btn canto-action-btn-envido"
                        title="Vale 2 puntos"
                      >
                        Envido
                      </button>
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() => handleOpenCanto("real_envido")}
                        className="canto-action-btn canto-action-btn-envido"
                        title="Vale 3 puntos"
                      >
                        Real Envido
                      </button>
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() => handleOpenCanto("falta_envido")}
                        className="canto-action-btn canto-action-btn-envido"
                        title="Vale lo que le falta al rival para ganar"
                      >
                        Falta Envido
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            {envidoSinging ? (
              <div className={panelClass("border-violet-400/25 bg-violet-950/40")}>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300/80">Canto del Envido</p>
                <h2 className="mt-1 text-xl font-semibold text-white capitalize">
                  {envidoSinging.cantoType === "falta_envido" ? "Falta Envido" : envidoSinging.cantoType === "real_envido" ? "Real Envido" : "Envido"}
                </h2>
                <div className="mt-4 space-y-2">
                  {envidoSinging.declarations.length === 0 ? (
                    <p className="text-sm text-slate-400">Esperando declaraciones…</p>
                  ) : (
                    envidoSinging.declarations.map((decl) => {
                      const seat = snapshot.seats.find((s) => s.id === decl.seatId);
                      const isMe = decl.seatId === currentSeat?.id;
                      return (
                        <div
                          key={decl.seatId}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            isMe
                              ? "border-cyan-300/25 bg-cyan-300/8"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {seat?.displayName ?? "Jugador"}
                              {isMe ? " (vos)" : ""}
                            </p>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                              Equipo {decl.teamSide}
                            </p>
                          </div>
                          <div className="text-right">
                            {decl.action === "son_buenas" ? (
                              <span className="text-sm font-bold text-emerald-400">Son buenas</span>
                            ) : (
                              <span className="text-2xl font-black text-white">{decl.score}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

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

            {isMyCantoResponse && pendingCantoType ? (
              <div className={panelClass("border-violet-300/20 bg-violet-300/8")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-100/80">Canto</p>
                  {cantoCountdown !== null ? (
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${cantoCountdown <= 3 ? "border-rose-300/40 bg-rose-300/12 text-rose-50" : "border-violet-300/40 bg-violet-300/12 text-violet-50"}`}>
                      {cantoCountdown}s
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {pendingCantoType === "truco" ? "Truco"
                    : pendingCantoType === "retruco" ? "Retruco"
                    : pendingCantoType === "vale_cuatro" ? "Vale Cuatro"
                    : pendingCantoType === "envido" ? "Envido (2 pts)"
                    : pendingCantoType === "real_envido" ? "Real Envido (3 pts)"
                    : "Falta Envido"}
                </h2>
                <p className="mt-2 text-sm text-slate-200">¿Querés aceptar, subir o rechazar?</p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => handleResolveCanto(pendingCantoType, "quiero")}
                    className="flex-1 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Quiero
                  </button>
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => handleResolveCanto(pendingCantoType, "no_quiero")}
                    className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    No Quiero
                  </button>
                </div>
                {/* Raise options for envido */}
                {(pendingCantoType === "envido" || pendingCantoType === "real_envido") ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <p className="w-full text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Subir a</p>
                    {pendingCantoType === "envido" ? (
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() => handleOpenCanto("envido")}
                        className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-300/20 disabled:opacity-60"
                        title="Envido + Envido = 4 puntos"
                      >
                        Envido →4
                      </button>
                    ) : null}
                    {(pendingCantoType === "envido") ? (
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() => handleOpenCanto("real_envido")}
                        className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-300/20 disabled:opacity-60"
                        title="Envido + Real Envido = 5 puntos"
                      >
                        Real Envido →5
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => handleOpenCanto("falta_envido")}
                      className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-300/20 disabled:opacity-60"
                      title="Termina la partida o vale lo que le falta al rival"
                    >
                      Falta Envido
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {finalSummary ? (
              <div className={panelClass("border-emerald-300/20")}>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/75">Resultado</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Ganó el equipo {finalSummary.winnerTeamSide === "A" ? "Cyan" : "Verde"}.
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Puntaje final {finalSummary.finalScore.A} - {finalSummary.finalScore.B}
                </p>

                {/* Avatares por equipo */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {(["A", "B"] as const).map((side) => {
                    const teamSeats = snapshot.seats.filter((s) => s.teamSide === side && s.displayName);
                    const isWinner = finalSummary.winnerTeamSide === side;
                    const borderColor = side === "A" ? "border-cyan-300/25" : "border-emerald-300/25";
                    const bgColor = side === "A" ? "bg-cyan-300/6" : "bg-emerald-300/6";
                    const labelColor = side === "A" ? "text-cyan-200/70" : "text-emerald-200/70";
                    const score = side === "A" ? finalSummary.finalScore.A : finalSummary.finalScore.B;
                    return (
                      <div key={side} className={`rounded-2xl border ${borderColor} ${bgColor} p-3`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${labelColor}`}>
                            Equipo {side === "A" ? "Cyan" : "Verde"}
                          </p>
                          {isWinner ? (
                            <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              Ganador
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-white">{score} pts</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {teamSeats.map((seat) => (
                            <div key={seat.id} className="flex flex-col items-center gap-1">
                              <AvatarCircle
                                avatarId={seat.avatarId}
                                tone={getAlienTone(seat, seat.seatIndex)}
                                size={36}
                              />
                              <span className="max-w-[56px] truncate text-center text-[10px] text-slate-300">
                                {seat.displayName}
                              </span>
                            </div>
                          ))}
                          {teamSeats.length === 0 ? (
                            <p className="text-xs text-slate-500">—</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

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

            {session ? (
              <div className={panelClass()}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Reacciones</p>
                  {visibleReactions.length > 0 ? (
                    <div className="flex gap-1.5">
                      {visibleReactions.slice(-5).map((r) => {
                        const seatName = snapshot.seats.find((s) => s.id === r.seatId)?.displayName;
                        return (
                          <span key={r.id} title={seatName ?? undefined} className="text-xl leading-none">
                            {r.reaction}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      disabled={actionPending}
                      onClick={() => handleSendReaction(emoji)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xl leading-none transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={panelClass("flex flex-col gap-0")}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Chat</p>
              <div className="mt-4 max-h-52 overflow-y-auto space-y-2 pr-1">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-slate-400">Todavía no hay mensajes.</p>
                ) : (
                  chatMessages.map((msg) => {
                    const seatName = snapshot.seats.find((s) => s.id === msg.seatId)?.displayName ?? "Anon";
                    const isMe = msg.seatId === currentSeat?.id;
                    return (
                      <div key={msg.id} className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? "border border-cyan-300/20 bg-cyan-300/10 text-cyan-50" : "border border-white/10 bg-white/[0.03] text-slate-200"}`}>
                        <span className="font-semibold">{seatName}: </span>
                        {msg.message}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
              {session ? (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); void handleSendChat(); }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    maxLength={200}
                    placeholder="Escribí un mensaje…"
                    className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/20"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || actionPending}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Enviar
                  </button>
                </form>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

