"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AvatarId,
  CantoOpenedEvent,
  CantoResolvedEvent,
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
  NormalCardSuit,
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
      return "DIMADONG";
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


function getCantoLabel(cantoType: CantoType) {
  switch (cantoType) {
    case "truco":
      return "Truco";
    case "retruco":
      return "Retruco";
    case "vale_cuatro":
      return "Vale Cuatro";
    case "real_envido":
      return "Real Envido";
    case "falta_envido":
      return "Falta Envido";
    case "envido":
    default:
      return "Envido";
  }
}

function getEnvidoChainLabel(callChain: string[] | null | undefined, fallback: string) {
  if (!callChain || callChain.length === 0) {
    return fallback;
  }

  return callChain.map((call) => getCantoLabel(call as CantoType)).join(" + ");
}

function getEnvidoWinnerSeatId(
  declarations: EnvidoSingingState["declarations"],
  manoSeatId: string | null,
) {
  let winnerSeatId = manoSeatId;
  let bestScore = -1;

  for (const declaration of declarations) {
    if (declaration.action !== "declared") {
      continue;
    }

    if (declaration.score > bestScore) {
      bestScore = declaration.score;
      winnerSeatId = declaration.seatId;
    } else if (declaration.score === bestScore) {
      winnerSeatId = manoSeatId;
    }
  }

  return winnerSeatId;
}

function isEnvidoWinningByMano(
  declarations: EnvidoSingingState["declarations"],
  manoSeatId: string | null,
) {
  if (!manoSeatId) {
    return false;
  }

  const declaredScores = declarations
    .filter((declaration) => declaration.action === "declared")
    .map((declaration) => declaration.score);

  if (declaredScores.length < 2) {
    return false;
  }

  const bestScore = Math.max(...declaredScores);
  const tiedBestCount = declaredScores.filter((score) => score === bestScore).length;

  if (tiedBestCount < 2) {
    return false;
  }

  return declarations.some(
    (declaration) =>
      declaration.seatId === manoSeatId &&
      declaration.action === "declared" &&
      declaration.score === bestScore,
  );
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

const WILDCARD_VISUAL = {
  iconPath: "/cards/wildcard/comodin-alien.png",
  fallback: "★",
  edge: "border-fuchsia-300/65",
  glow: "shadow-[0_0_30px_rgba(205,88,255,0.38)]",
  miniGlow: "drop-shadow-[0_0_10px_rgba(98,255,244,0.9)]",
  miniSizeClass: "h-7 w-7",
  centerSizeWatermarkClass: "h-34 w-34",
  centerSizeHologramClass: "h-26 w-26",
} as const;

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

const SUIT_FACE_GRADIENT: Record<NormalCardSuit, string> = {
  oro: "bg-[linear-gradient(180deg,#fffdf0_0%,#fef9e0_55%,#fbedbb_100%)]",
  copa: "bg-[linear-gradient(180deg,#fdf0ff_0%,#f3e6ff_55%,#e5d0f7_100%)]",
  espada: "bg-[linear-gradient(180deg,#f0f9ff_0%,#e4f1ff_55%,#cfe0f5_100%)]",
  basto: "bg-[linear-gradient(180deg,#f0fff5_0%,#e4f7ec_55%,#cfeedd_100%)]",
};

const SUIT_ACCENT_BAR: Record<NormalCardSuit, string> = {
  oro: "bg-[linear-gradient(90deg,#f5c518,#ffe066,#f5c518)]",
  copa: "bg-[linear-gradient(90deg,#a855f7,#d8b4fe,#a855f7)]",
  espada: "bg-[linear-gradient(90deg,#06b6d4,#a5f3fc,#06b6d4)]",
  basto: "bg-[linear-gradient(90deg,#10b981,#6ee7b7,#10b981)]",
};

const SUIT_CORNER_TONE: Record<NormalCardSuit, string> = {
  oro: "text-rose-700",
  copa: "text-rose-700",
  espada: "text-slate-800",
  basto: "text-slate-800",
};

const SUIT_VISUALS: Record<NormalCardSuit, SuitVisual> = {
  oro: {
    iconPath: "/cards/suits/oro.png",
    fallback: "O",
    edge: "border-lime-300/55",
    glow: "shadow-[0_0_26px_rgba(196,255,92,0.26)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(224,255,132,0.9)]",
    miniSizeClass: "h-8 w-8",
    centerSizeWatermarkClass: "h-32 w-32",
    centerSizeHologramClass: "h-24 w-24",
  },
  copa: {
    iconPath: "/cards/suits/copa.png",
    fallback: "C",
    edge: "border-violet-300/55",
    glow: "shadow-[0_0_26px_rgba(182,113,255,0.3)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(212,168,255,0.9)]",
    miniSizeClass: "h-7 w-7",
    centerSizeWatermarkClass: "h-28 w-28",
    centerSizeHologramClass: "h-22 w-22",
  },
  espada: {
    iconPath: "/cards/suits/espada.png",
    fallback: "E",
    edge: "border-cyan-300/55",
    glow: "shadow-[0_0_26px_rgba(73,226,255,0.28)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(142,248,255,0.9)]",
    miniSizeClass: "h-8 w-8",
    centerSizeWatermarkClass: "h-32 w-32",
    centerSizeHologramClass: "h-24 w-24",
  },
  basto: {
    iconPath: "/cards/suits/basto.png",
    fallback: "B",
    edge: "border-emerald-300/55",
    glow: "shadow-[0_0_26px_rgba(91,255,142,0.28)]",
    miniGlow: "drop-shadow-[0_0_8px_rgba(147,255,181,0.9)]",
    miniSizeClass: "h-8 w-8",
    centerSizeWatermarkClass: "h-31 w-31",
    centerSizeHologramClass: "h-23 w-23",
  },
};

function SuitIcon({
  suit,
  alt,
  className,
}: {
  suit: NormalCardSuit;
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

function WildcardIcon({
  alt,
  className,
}: {
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`inline-flex items-center justify-center font-black text-white ${className}`}>
        {WILDCARD_VISUAL.fallback}
      </span>
    );
  }

  return (
    <img
      src={WILDCARD_VISUAL.iconPath}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function PlayedCard({ play, faded = false }: { play: TablePlayView; faded?: boolean }) {
  const card = play.card;
  const normalSuit: NormalCardSuit | null = card.suit === "comodin" ? null : card.suit;
  const visual = normalSuit ? SUIT_VISUALS[normalSuit] : WILDCARD_VISUAL;
  const rank = card.isWildcard ? "★" : `${card.rank}`;

  const faceClass = card.isWildcard
    ? "bg-[radial-gradient(circle_at_top,rgba(107,66,255,0.65),rgba(21,26,58,0.98)_60%,rgba(10,13,31,1)_100%)]"
    : normalSuit ? SUIT_FACE_GRADIENT[normalSuit] : "bg-white";
  const borderClass = card.isWildcard ? "border-fuchsia-300/65" : visual.edge;
  const rankTone = card.isWildcard ? "text-cyan-50" : normalSuit ? SUIT_CORNER_TONE[normalSuit] : "text-slate-800";

  return (
    <div className={`flex flex-col items-center gap-2 transition-opacity duration-500 ${faded ? "opacity-35" : "opacity-100"}`}>
      <div className={`relative w-[72px] h-[100px] overflow-hidden rounded-xl border shadow-[0_10px_28px_rgba(0,0,0,0.5)] ${faceClass} ${borderClass}`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.38),transparent_28%)]" />
        {normalSuit ? (
          <div className={`absolute inset-x-0 top-0 h-1 ${SUIT_ACCENT_BAR[normalSuit]} opacity-85`} />
        ) : null}
        <div className="absolute top-1.5 left-1.5 flex flex-col items-center gap-0.5">
          <span className={`text-[1.35rem] font-black leading-none [text-shadow:0_1px_3px_rgba(0,0,0,0.12)] ${rankTone}`}>{rank}</span>
          {normalSuit ? (
            <SuitIcon suit={normalSuit} alt={normalSuit} className={`h-4 w-4 object-contain ${visual.miniGlow}`} />
          ) : null}
        </div>
        <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2">
          {normalSuit ? (
            <SuitIcon suit={normalSuit} alt={normalSuit} className="h-11 w-11 object-contain opacity-70" />
          ) : (
            <WildcardIcon alt="comodin" className="h-10 w-10 object-contain opacity-80" />
          )}
        </div>
      </div>
      <p className="max-w-[80px] truncate text-center text-xs font-semibold text-slate-300">
        {play.displayName ?? "Mesa"}
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const normalSuit: NormalCardSuit | null = card.suit === "comodin" ? null : card.suit;
  const visual = normalSuit ? SUIT_VISUALS[normalSuit] : WILDCARD_VISUAL;
  const cornerRank = card.isWildcard ? "★" : `${card.rank}`;

  const centerSizeClass =
    artMode === "hologram"
      ? visual.centerSizeHologramClass
      : visual.centerSizeWatermarkClass;

  const centerIconClass =
    artMode === "hologram"
      ? `${centerSizeClass} opacity-100 drop-shadow-[0_0_20px_rgba(255,255,255,0.62)]`
      : `${centerSizeClass} opacity-52`;

  // Emojis para las 4 cartas especiales (las más fuertes del mazo)
  const specialEmoji: string | null =
    card.rank === 1 && card.suit === "espada" ? "⚔️" :
    card.rank === 1 && card.suit === "basto" ? "🪄" :
    card.rank === 7 && card.suit === "espada" ? "⚡" :
    card.rank === 7 && card.suit === "oro" ? "💰" :
    null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative h-full min-h-[184px] w-full overflow-hidden rounded-[1rem] border bg-[rgba(12,17,34,0.86)] transition disabled:cursor-not-allowed disabled:opacity-55 ${visual.edge} ${active ? `${visual.glow} ring-2 ring-white/15` : "shadow-[inset_0_0_16px_rgba(0,0,0,0.5)]"} ${!disabled ? "hover:-translate-y-0.5 hover:bg-[rgba(15,23,46,0.9)]" : ""}`}
    >
      {/* Gloss overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(165deg,rgba(255,255,255,0.10),transparent_35%)] pointer-events-none" />

      {card.isWildcard ? (
        <>
          <div className="absolute left-3 top-3 z-10 rounded-full border border-cyan-300/55 bg-slate-950/72 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-100 shadow-[0_0_12px_rgba(73,226,255,0.28)]">
            *
          </div>
          <div className="absolute right-2 top-2 z-10 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/12 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-fuchsia-100">
            Wild
          </div>
        </>
      ) : (
        <div className="absolute top-2 left-2 flex flex-col items-center gap-1 z-10">
          <span className="text-[1.5rem] font-black leading-none text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
            {cornerRank}
          </span>
          <SuitIcon
            suit={normalSuit!}
            alt={normalSuit!}
            className={`${visual.miniSizeClass} object-contain ${visual.miniGlow}`}
          />
        </div>
      )}

      {/* Emoji badge para cartas especiales */}
      {specialEmoji ? (
        <div className="absolute bottom-2 right-2 z-10 text-xl leading-none drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
          {specialEmoji}
        </div>
      ) : null}

      {/* Center: watermark / hologram suit art */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {card.isWildcard ? (
          <WildcardIcon alt="DIMADONG alien" className={`${centerIconClass} object-contain`} />
        ) : (
          <SuitIcon suit={normalSuit!} alt={normalSuit!} className={centerIconClass} />
        )}
      </div>

      {card.isWildcard ? (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-cyan-200/84">
            DIMADONG
          </p>
          <p className="mt-1 text-[0.9rem] font-black tracking-[0.18em] text-white">
            {card.label}
          </p>
        </div>
      ) : null}
    </button>
  );
}

function ReadableTrucoCardSprite({
  card,
  subtitle,
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
  const normalSuit: NormalCardSuit | null = card.suit === "comodin" ? null : card.suit;
  const visual = normalSuit ? SUIT_VISUALS[normalSuit] : WILDCARD_VISUAL;
  const isWildcardCard = card.isWildcard;
  const cornerRank = isWildcardCard ? "★" : `${card.rank}`;

  const centerSizeClass =
    artMode === "hologram"
      ? visual.centerSizeHologramClass
      : visual.centerSizeWatermarkClass;

  const centerIconClass =
    artMode === "hologram"
      ? `${centerSizeClass} opacity-95 drop-shadow-[0_0_24px_rgba(255,255,255,0.24)]`
      : `${centerSizeClass} opacity-88 drop-shadow-[0_2px_12px_rgba(0,0,0,0.18)]`;

  const cardFaceClass = isWildcardCard
    ? "bg-[radial-gradient(circle_at_top,rgba(107,66,255,0.65),rgba(21,26,58,0.98)_42%,rgba(10,13,31,1)_100%)] text-white"
    : `${normalSuit ? SUIT_FACE_GRADIENT[normalSuit] : "bg-white"} text-slate-950`;
  const cardBorderClass = isWildcardCard
    ? `${visual.edge} shadow-[0_0_28px_rgba(205,88,255,0.26)]`
    : `${visual.edge} border-white/80 shadow-[0_20px_34px_rgba(2,6,23,0.28)]`;
  const cornerToneClass = isWildcardCard
    ? "text-cyan-50"
    : normalSuit ? SUIT_CORNER_TONE[normalSuit] : "text-slate-800";
  const labelToneClass = isWildcardCard
    ? "border-white/10 bg-slate-950/35 text-cyan-50"
    : "border-slate-900/10 bg-white/72 text-slate-700";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative h-full min-h-[224px] w-full overflow-hidden rounded-[1.3rem] border transition disabled:cursor-not-allowed disabled:opacity-55 ${cardFaceClass} ${cardBorderClass} ${active ? `${visual.glow} ring-2 ring-cyan-200/30` : ""} ${!disabled ? "hover:-translate-y-1 hover:shadow-[0_24px_40px_rgba(15,23,42,0.26)]" : ""}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.42),transparent_26%,rgba(255,255,255,0.06)_70%,rgba(15,23,42,0.12)_100%)]" />
      <div className="pointer-events-none absolute inset-[10px] rounded-[1rem] border border-black/8" />
      <div className="pointer-events-none absolute inset-x-3 top-3 h-8 rounded-full bg-white/40 blur-2xl" />

      {/* Suit accent bar */}
      {!isWildcardCard && normalSuit ? (
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 ${SUIT_ACCENT_BAR[normalSuit]} opacity-80`} />
      ) : null}

      {isWildcardCard ? (
        <>
          <div className="absolute left-3 top-3 z-10 rounded-full border border-cyan-300/55 bg-slate-950/72 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-100 shadow-[0_0_12px_rgba(73,226,255,0.28)]">
            *
          </div>
          <div className="absolute right-2 top-2 z-10 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/12 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-fuchsia-100">
            Wild
          </div>
        </>
      ) : (
        <div className="absolute left-3 top-3 z-10 flex flex-col items-center gap-1">
          <span className={`text-[2.1rem] font-black leading-none [text-shadow:0_1px_4px_rgba(0,0,0,0.15)] ${cornerToneClass}`}>
            {cornerRank}
          </span>
          <SuitIcon
            suit={normalSuit!}
            alt={normalSuit!}
            className={`${visual.miniSizeClass} object-contain ${visual.miniGlow}`}
          />
        </div>
      )}

      {!isWildcardCard ? (
        <div className="absolute bottom-3 right-3 z-10 flex rotate-180 flex-col items-center gap-1">
          <span className={`text-[2.1rem] font-black leading-none [text-shadow:0_1px_4px_rgba(0,0,0,0.15)] ${cornerToneClass}`}>
            {cornerRank}
          </span>
          <SuitIcon
            suit={normalSuit!}
            alt={normalSuit!}
            className={`${visual.miniSizeClass} object-contain ${visual.miniGlow}`}
          />
        </div>
      ) : null}

      <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
        {isWildcardCard ? (
          <WildcardIcon alt="DIMADONG alien" className={`${centerIconClass} object-contain`} />
        ) : (
          <SuitIcon suit={normalSuit!} alt={normalSuit!} className={centerIconClass} />
        )}
      </div>

      <div className={`absolute inset-x-3 bottom-3 z-10 rounded-2xl border px-3 py-2 text-center backdrop-blur-sm ${labelToneClass}`}>
        <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.28em] ${isWildcardCard ? "text-cyan-200/84" : "text-slate-500"}`}>
          {isWildcardCard ? "DIMADONG" : subtitle}
        </p>
        <p className={`mt-1 text-[0.95rem] font-black tracking-[0.14em] ${isWildcardCard ? "text-white" : "text-slate-950"}`}>
          {card.label}
        </p>
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

type ResolvedCantoBanner = {
  id: string;
  label: string;
  sentAt: number;
};

const REACTIONS = ["👽", "🛸", "🔥", "💀", "⚡", "🌟"];
const REACTION_TTL_MS = 4_000;
const CANTO_TTL_MS = 7_000;
const RESOLVED_CANTO_TTL_MS = 4_000;
const SOCKET_ACK_TIMEOUT_MS = 18_000;

function getReactionBubbleClass(relativeOffset: number) {
  if (relativeOffset === 1) {
    return "right-[-0.4rem] top-1/2 -translate-y-1/2 translate-x-full";
  }

  if (relativeOffset === 3) {
    return "left-[-0.4rem] top-1/2 -translate-x-full -translate-y-1/2";
  }

  return "left-1/2 top-[-0.55rem] -translate-x-1/2 -translate-y-full";
}

function getCantoResolutionLabel(event: CantoResolvedEvent) {
  const cantoLabel = getCantoLabel(event.cantoType);
  switch (event.result) {
    case "quiero":
      return `${cantoLabel}: quiero`;
    case "no_quiero":
      return `${cantoLabel}: no quiero`;
    case "accepted":
      return `${cantoLabel} aceptado`;
    case "rejected":
      return `${cantoLabel} rechazado`;
    default:
      return cantoLabel;
  }
}

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

function HandSummaryOverlay({
  event,
  snapshot,
  onDismiss,
}: {
  event: HandScoredEvent;
  snapshot: RoomSnapshot;
  onDismiss: () => void;
}) {
  const TOTAL_MS = 5000;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      if (ms >= TOTAL_MS) {
        clearInterval(id);
        onDismiss();
      }
    }, 80);
    return () => clearInterval(id);
  }, [onDismiss]);

  const progress = Math.min(elapsed / TOTAL_MS, 1);
  const winnerSide = event.handWinnerTeamSide;

  const teamLabel = (side: TeamSide) => {
    const names = snapshot.seats
      .filter((s) => s.teamSide === side)
      .map((s) => s.displayName ?? "?")
      .filter(Boolean);
    return names.length ? names.join(" & ") : `Equipo ${side}`;
  };

  return (
    <div className="hand-summary-in absolute inset-0 z-40 flex items-center justify-center bg-slate-950/82 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(10,16,36,0.99),rgba(6,11,24,0.99))] p-6 shadow-[0_0_100px_rgba(83,234,253,0.14),0_0_0_1px_rgba(255,255,255,0.05)_inset]">
        {/* Header */}
        <div className="text-center">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
            Mano {event.handNumber} terminada
          </p>
          <p className="font-brand-display mt-2 text-2xl text-white">
            {!winnerSide ? "Mano empatada" : `Ganó Equipo ${winnerSide}`}
          </p>
          {winnerSide ? (
            <p className="mt-1 text-sm text-slate-300">{teamLabel(winnerSide)}</p>
          ) : null}
        </div>

        {/* Trick results */}
        <div className="mt-5 space-y-2">
          {event.resolvedTricks.map((trick) => {
            const side = trick.winnerTeamSide;
            const sideColor =
              side === "A"
                ? "text-cyan-300"
                : side === "B"
                  ? "text-emerald-300"
                  : "text-slate-400";
            return (
              <div
                key={trick.trickNumber}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5"
              >
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Baza {trick.trickNumber}
                </span>
                <span className={`text-sm font-semibold ${sideColor}`}>
                  {!side
                    ? "Empate"
                    : `Eq. ${side}${trick.winningCardLabel ? ` · ${trick.winningCardLabel}` : ""}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scoreboard */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {(["A", "B"] as TeamSide[]).map((side) => {
            const isWinner = side === winnerSide;
            const border = side === "A" ? "border-cyan-300/25" : "border-emerald-300/25";
            const bg = side === "A" ? "bg-cyan-300/10" : "bg-emerald-300/10";
            const labelColor = side === "A" ? "text-cyan-200/70" : "text-emerald-200/70";
            const numColor = side === "A" ? "text-cyan-100" : "text-emerald-100";
            return (
              <div
                key={side}
                className={`rounded-2xl border ${border} ${bg} px-4 py-3 text-center ${isWinner ? "ring-1 ring-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" : ""}`}
              >
                <p className={`text-[0.6rem] font-semibold uppercase tracking-[0.26em] ${labelColor}`}>
                  {teamLabel(side)}
                </p>
                <p className={`mt-1 text-3xl font-bold tabular-nums ${numColor}`}>
                  {event.score[side]}
                </p>
                <p className="text-[0.56rem] uppercase tracking-widest text-slate-500">
                  de {snapshot.targetScore}
                </p>
              </div>
            );
          })}
        </div>

        {/* Auto-dismiss progress + button */}
        <div className="mt-5 space-y-3">
          <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-400/60"
              style={{ width: `${progress * 100}%`, transition: "width 80ms linear" }}
            />
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-full border border-white/12 bg-white/[0.06] py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recentReactions, setRecentReactions] = useState<ActiveReaction[]>([]);
  const [recentCantos, setRecentCantos] = useState<ActiveCanto[]>([]);
  const [resolvedCantoBanner, setResolvedCantoBanner] = useState<ResolvedCantoBanner | null>(null);
  const [lastTrickCards, setLastTrickCards] = useState<TablePlayView[]>([]);
  const [envidoSinging, setEnvidoSinging] = useState<EnvidoSingingState | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [lastHandScoredEvent, setLastHandScoredEvent] = useState<HandScoredEvent | null>(null);
  const [isDealAnimActive, setIsDealAnimActive] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pendingCantoHasBong, setPendingCantoHasBong] = useState(false);
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

  useEffect(() => {
    if (recentCantos.length === 0) return;
    const id = setInterval(() => {
      setRecentCantos((prev) => prev.filter((c) => Date.now() - c.sentAt < CANTO_TTL_MS));
    }, 1_000);
    return () => clearInterval(id);
  }, [recentCantos.length]);

  useEffect(() => {
    if (!resolvedCantoBanner) return;
    const id = window.setTimeout(() => {
      setResolvedCantoBanner((current) =>
        current?.id === resolvedCantoBanner.id ? null : current,
      );
    }, RESOLVED_CANTO_TTL_MS);
    return () => window.clearTimeout(id);
  }, [resolvedCantoBanner]);

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

  // Trigger deal animation when server enters 'dealing' phase (first hand and new hands via phase)
  useEffect(() => {
    if (currentPhaseForNav === "dealing") {
      setIsDealAnimActive(true);
      const t = setTimeout(() => setIsDealAnimActive(false), 2000);
      return () => clearTimeout(t);
    }
  }, [currentPhaseForNav]);

  const dismissHandSummary = useCallback(() => {
    setLastHandScoredEvent(null);
    setIsDealAnimActive(true);
    setTimeout(() => setIsDealAnimActive(false), 1800);
  }, []);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

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
          setPendingCantoHasBong(event.hasBong ?? false);
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
          setResolvedCantoBanner({
            id: `${event.cantoType}-${event.resolvedAt}`,
            label: getCantoResolutionLabel(event),
            sentAt: Date.now(),
          });
          setPendingCantoHasBong(false);
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
          setLastTrickCards([]);
          setLastHandScoredEvent(event);
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

  const handleManualResync = () => {
    setError(null);
    setConnectionLabel("Sincronizando...");
    void refreshRoomStateRef.current?.().catch((caughtError) => {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo resincronizar la sala.");
      setConnectionLabel("Reconectando...");
    });
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

  const handleOpenCanto = async (cantoType: CantoType, withBong = false) => {
    if (!session) {
      return;
    }
    const payload: CantoOpenPayload = {
      roomCode: normalizedCode,
      roomSessionToken: session.roomSessionToken,
      clientActionId: crypto.randomUUID(),
      cantoType,
      withBong,
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
  const currentHandPoints = matchView?.currentHandPoints ?? 1;
  const canCallEnvido = trickNumber === 1 && !trucoOpened && !envidoResolved;
  const needsWildcardSelection =
    wildcardSelection?.isPending === true && wildcardSelection.ownerSeatId === currentSeat?.id;
  const manoSeatId = matchView?.dealerSeatId ?? matchState?.dealerSeatId ?? null;
  const envidoWinnerSeatId = envidoSinging
    ? getEnvidoWinnerSeatId(envidoSinging.declarations, manoSeatId)
    : null;
  const envidoWinningByMano = envidoSinging
    ? isEnvidoWinningByMano(envidoSinging.declarations, manoSeatId)
    : false;
  const actionTurnTrucoOptions: CantoType[] =
    currentHandPoints >= 3 ? ["vale_cuatro"] : currentHandPoints >= 2 ? ["retruco"] : ["truco"];
  const responseRaiseOptions: CantoType[] =
    pendingCantoType === "truco"
      ? ["retruco"]
      : pendingCantoType === "retruco"
        ? ["vale_cuatro"]
        : pendingCantoType === "envido"
          ? ["envido", "real_envido", "falta_envido"]
          : pendingCantoType === "real_envido"
            ? ["falta_envido"]
            : [];

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

      <section className={panelClass(isLobby ? "" : "overflow-hidden border-cyan-300/15 bg-[linear-gradient(135deg,rgba(8,15,32,0.98),rgba(11,19,40,0.94)_55%,rgba(7,12,24,0.98)_100%)]")}>
        <div className={`flex flex-wrap gap-4 ${isLobby ? "items-start justify-between" : "items-center justify-between"}`}>
          <div className={isLobby ? "space-y-2" : "flex flex-wrap items-center gap-3"}>
            {isLobby ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Sala</p>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{snapshot.code}</h1>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] transition ${
                      linkCopied
                        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                        : "border-white/15 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-200"
                    }`}
                  >
                    {linkCopied ? "✓ Copiado" : "Invitar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-100/80">
                  Sala
                </span>
                <h1 className="font-brand-display text-xl text-white sm:text-2xl">{snapshot.code}</h1>
                <span className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClass()}`}>
                  {connectionLabel}
                </span>
                <span className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClass()}`}>
                  {phaseLabel}
                </span>
              </>
            )}
            <p className={`${isLobby ? "max-w-2xl text-sm text-slate-300" : "max-w-2xl text-sm text-slate-300 sm:min-w-[280px]"}`}>
              {statusText}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isMyTurn && turnCountdown !== null ? (
              <span className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${turnCountdown <= 3 ? "border-rose-300/40 bg-rose-300/12 text-rose-50" : "border-cyan-300/40 bg-cyan-300/12 text-cyan-50"}`}>
                {turnCountdown}s
              </span>
            ) : null}
            {phase === "reconnect_hold" && reconnectCountdown !== null ? (
              <span className="rounded-full border border-amber-300/40 bg-amber-300/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-50">
                Reconectando {reconnectCountdown}s
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleManualResync}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/10"
            >
              Resincronizar
            </button>
          </div>
        </div>

        {resolvedCantoBanner ? (
          <div className="mt-5 rounded-2xl border border-violet-300/25 bg-violet-300/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200/80">Ultimo canto</p>
            <p className="mt-1 text-sm font-semibold text-violet-50">{resolvedCantoBanner.label}</p>
          </div>
        ) : null}

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
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">Previa</p>
                <h2 className="mt-1.5 text-xl font-bold text-white">Mesa alien</h2>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] ${badgeClass(everybodyReady)}`}>
                {filledSeats.length}/{snapshot.maxPlayers}
              </span>
            </div>

            <div className="ovni-table-surface relative mt-8 min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10">
              <div className="ufo-pulse absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_center,rgba(83,234,253,0.2),rgba(13,19,38,0.96)_58%,rgba(9,16,29,1)_100%)] shadow-[0_0_70px_rgba(83,234,253,0.18)]" />
              <div className="absolute left-1/2 top-1/2 h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(255,212,54,0.12),rgba(6,11,24,0.82)_62%,rgba(6,11,24,0)_100%)]" />
              <div className="absolute left-1/2 top-1/2 flex w-[220px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-300/50">{snapshot.code}</p>
                <p className="font-brand-display mt-2 text-2xl text-white">Plato volador</p>
                <p className="mt-3 text-xl text-cyan-200/20 select-none">⬡</p>
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
                            {seat.displayName ?? "—"}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {seat.teamSide ? `Equipo ${seat.teamSide}` : "Equipo ?"}
                          </p>
                          {(() => {
                            if (!seat.displayName) return (
                              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                                libre
                              </span>
                            );
                            if (seat.isReady) return (
                              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                listo
                              </span>
                            );
                            return (
                              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
                                <span className={`h-1.5 w-1.5 rounded-full bg-amber-400 ${isCurrentSeat ? "pulse-dot" : ""}`} />
                                {isCurrentSeat ? "falta vos" : "espera"}
                              </span>
                            );
                          })()}
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
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300/60">Cabina</p>
            </div>

            <div className="grid gap-2">
              {([
                { label: "MODO", value: snapshot.maxPlayers === 2 ? "1×1" : "2×2", ok: true },
                { label: "PUNTOS", value: `${snapshot.targetScore}`, ok: true },
                { label: "EQUIPOS", value: teamsBalanced ? "OK" : "FALTA", ok: teamsBalanced },
                { label: "BONGS", value: snapshot.allowBongs ? "ON" : "OFF", ok: snapshot.allowBongs },
              ] as { label: string; value: string; ok: boolean }[]).map((item) => (
                <div key={item.label} className="hud-row flex items-center justify-between rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">{item.label}</span>
                  <span className={`text-sm font-bold tracking-wide ${item.ok ? "text-cyan-200" : "text-amber-300"}`}>{item.value}</span>
                </div>
              ))}
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
                <div className="absolute inset-[7%] rounded-[2.4rem] border border-cyan-300/8" />
                <div className="absolute inset-x-[14%] top-[11%] h-[72%] rounded-[50%] border border-white/6" />
                <div className="ufo-pulse absolute left-1/2 top-1/2 h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_center,rgba(83,234,253,0.26),rgba(12,18,38,0.98)_52%,rgba(8,13,29,1)_100%)] shadow-[0_0_110px_rgba(83,234,253,0.24)]" />
                <div className="absolute left-1/2 top-1/2 h-[248px] w-[248px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(255,210,54,0.16),rgba(8,13,29,0.08)_70%,transparent_100%)]" />
                <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-center backdrop-blur">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Ronda actual</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    Mano {matchView?.handNumber ?? "-"} · Baza {matchView?.trickNumber ?? "-"}
                  </p>
                </div>
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

                  const seatReactions = visibleReactions.filter((r) => r.seatId === seat.id).slice(-2);
                  const seatCantos = visibleCantos.filter((c) => c.seatId === seat.id).slice(-2);

                  return (
                    <div key={seat.id} className={`absolute z-20 ${getSeatPositionClass(snapshot.maxPlayers, relativeOffset)}`}>
                      {seatReactions.length > 0 ? (
                        <div className={`pointer-events-none absolute z-30 flex gap-2 ${getReactionBubbleClass(relativeOffset)}`}>
                          {seatReactions.map((r) => (
                            <span
                              key={r.id}
                              className="reaction-pop flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200/50 bg-slate-950/88 text-3xl shadow-[0_0_24px_rgba(83,234,253,0.34)] backdrop-blur-sm"
                            >
                              {r.reaction}
                            </span>
                          ))}
                        </div>
                      ) : null}
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
                            {snapshot.allowBongs && seat.bongBalance !== 0 ? (
                              <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${seat.bongBalance > 0 ? "border-amber-300/40 bg-amber-300/10 text-amber-300" : "border-rose-300/30 bg-rose-300/8 text-rose-300"}`}>
                                <span>{seat.bongBalance > 0 ? "+" : ""}{seat.bongBalance}</span>
                                <span>BONG</span>
                              </span>
                            ) : null}
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
                  <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex items-end justify-center gap-3">
                      {displayTableCards.map((play, index) => (
                        <PlayedCard
                          key={`${play.seatId}-${play.card.id}-${index}`}
                          play={play}
                          faded={isShowingLastTrick}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {lastHandScoredEvent ? (
                  <HandSummaryOverlay
                    event={lastHandScoredEvent}
                    snapshot={snapshot}
                    onDismiss={dismissHandSummary}
                  />
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
                  <p className="mt-2 text-sm text-slate-300">
                    {matchView?.yourHand.length
                      ? "Tus cartas están separadas y listas para jugar."
                      : "Todavía no llegaron cartas a tu mano."}
                  </p>
                </div>
                {isMyTurn ? (
                  <span className="rounded-full border border-cyan-300/40 bg-cyan-300/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    Te toca
                  </span>
                ) : null}
              </div>

              <div className="mt-5 overflow-x-auto overflow-y-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 pb-6 pt-4 sm:px-4">
                {matchView?.yourHand.length ? (
                  <div className="relative flex min-h-[300px] min-w-max items-end gap-4 px-2 sm:min-h-[320px] sm:justify-center">
                    <div className="absolute inset-x-8 bottom-0 h-10 rounded-full bg-black/40 blur-2xl" />
                    {matchView.yourHand.map((card, index) => (
                      <div
                        key={card.id}
                        className={`relative shrink-0 transition md:hover:z-20 md:hover:-translate-y-4 ${isDealAnimActive ? "card-deal-in" : ""}`}
                        style={{
                          zIndex: index + 1,
                          width: "clamp(148px, 30vw, 220px)",
                          animationDelay: isDealAnimActive ? `${index * 0.11}s` : undefined,
                        }}
                      >
                        <ReadableTrucoCardSprite
                          card={card}
                          subtitle={card.isWildcard ? "DIMADONG alien" : `${card.rank} de ${card.suit}`}
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
                  {actionTurnTrucoOptions.map((cantoType) => (
                    <div key={cantoType} className="flex gap-1">
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() => handleOpenCanto(cantoType)}
                        className="canto-action-btn canto-action-btn-truco"
                      >
                        {getCantoLabel(cantoType)}
                      </button>
                      {snapshot.allowBongs ? (
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => handleOpenCanto(cantoType, true)}
                          className="canto-action-btn canto-action-btn-bong"
                          title={`${getCantoLabel(cantoType)} + BONG`}
                        >
                          BONG
                        </button>
                      ) : null}
                    </div>
                  ))}
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
                  {getEnvidoChainLabel(envidoSinging.callChain, getCantoLabel(envidoSinging.cantoType as CantoType))}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
                  {manoSeatId ? (
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100">
                      Mano: {snapshot.seats.find((seat) => seat.id === manoSeatId)?.displayName ?? "Jugador"}
                    </span>
                  ) : null}
                  {envidoWinnerSeatId && envidoSinging.declarations.length > 0 ? (
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                      {envidoWinningByMano ? "Gana por mano: " : "Va ganando: "}
                      {snapshot.seats.find((seat) => seat.id === envidoWinnerSeatId)?.displayName ?? "Jugador"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {envidoSinging.declarations.length === 0
                    ? "Todavia no se cantaron los puntos."
                    : "Se muestran los puntos declarados por cada jugador; si alguien no supera la marca, aparece como son buenas."}
                </p>
                <div className="mt-4 space-y-2">
                  {envidoSinging.declarations.length === 0 ? (
                    <p className="text-sm text-slate-400">Esperando declaraciones...</p>
                  ) : (
                    envidoSinging.declarations.map((decl, index) => {
                      const seat = snapshot.seats.find((s) => s.id === decl.seatId);
                      const isMe = decl.seatId === currentSeat?.id;
                      const isMano = decl.seatId === manoSeatId;
                      const isWinner = decl.seatId === envidoWinnerSeatId && decl.action === "declared";
                      const previousCallingBest = envidoSinging.declarations
                        .slice(0, index)
                        .filter((item) => item.teamSide === envidoSinging.callerTeamSide && item.action === "declared")
                        .reduce((best, item) => Math.max(best, item.score), 0);
                      const sonBuenasReason =
                        decl.action === "son_buenas"
                          ? previousCallingBest > 0
                            ? `No supera los ${previousCallingBest} ya cantados por el equipo que abrio.`
                            : "El equipo que abrio ya sostiene la mejor marca."
                          : null;
                      return (
                        <div
                          key={decl.seatId}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            isWinner
                              ? "border-emerald-300/30 bg-emerald-300/10"
                              : isMe
                                ? "border-cyan-300/25 bg-cyan-300/8"
                                : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {seat?.displayName ?? "Jugador"}
                              {isMe ? " (vos)" : ""}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                                Equipo {decl.teamSide}
                              </span>
                              {isMano ? (
                                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                                  Mano
                                </span>
                              ) : null}
                              {isWinner ? (
                                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                                  {envidoWinningByMano ? "Gana por mano" : "Ganando"}
                                </span>
                              ) : null}
                            </div>
                            {sonBuenasReason ? (
                              <p className="mt-1 text-xs text-slate-400">{sonBuenasReason}</p>
                            ) : null}
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
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/80">DIMADONG</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Elegí cómo juega.</h2>
                <p className="mt-2 text-sm text-slate-200">
                  {wildcardSelection.fixedForEnvido
                    ? "Este DIMADONG qued? fijado para el envido, as? que eleg? el valor que va a sostener durante la mano."
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
                  {getCantoLabel(pendingCantoType)}
                  {pendingCantoHasBong ? <span className="ml-2 font-brand-display text-amber-300"> + BONG</span> : null}
                </h2>
                {pendingCantoHasBong ? (
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-300/80">Si aceptás, aceptás el BONG también</p>
                ) : null}
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
                {responseRaiseOptions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <p className="w-full text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Subir a</p>
                    {responseRaiseOptions.map((cantoType) => (
                      <div key={cantoType} className="flex gap-1">
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => handleOpenCanto(cantoType)}
                          className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-300/20 disabled:opacity-60"
                        >
                          {getCantoLabel(cantoType)}
                        </button>
                        {snapshot.allowBongs ? (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => handleOpenCanto(cantoType, true)}
                            className="rounded-full border border-amber-300/40 bg-amber-300/12 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-60"
                          >
                            BONG
                          </button>
                        ) : null}
                      </div>
                    ))}
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
                          <span key={r.id} title={seatName ?? undefined} className="text-base leading-none opacity-70">
                            {r.reaction}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">Ahora salen arriba del asiento que las manda.</p>
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
