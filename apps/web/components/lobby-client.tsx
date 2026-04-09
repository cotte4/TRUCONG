"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  LobbyActionPayload,
  LobbyTeamPayload,
  MatchView,
  PlayCardPayload,
  ResumeRoomResponse,
  RoomSession,
  RoomSnapshot,
  TeamSide,
} from "@dimadong/contracts";
import { apiBaseUrl, socketBaseUrl } from "@/lib/config";
import { CantoStateShell } from "@/components/surfaces/canto-state-shell";
import { ConnectionStateCard } from "@/components/surfaces/connection-state-card";
import { EventFeed } from "@/components/surfaces/event-feed";
import { MatchSummaryPanel } from "@/components/surfaces/match-summary-panel";
import { LifecycleRail, type LifecycleItem } from "@/components/surfaces/lifecycle-rail";
import { ResolutionBanner } from "@/components/surfaces/resolution-banner";
import { ScorePanel } from "@/components/surfaces/score-panel";
import { SocialPanels } from "@/components/surfaces/social-panels";
import { WildcardPromptShell } from "@/components/surfaces/wildcard-prompt-shell";

function getSessionStorageKey(code: string) {
  return `dimadong:${code}:session`;
}

type RoomLifecycleState = RoomSnapshot["phase"] | NonNullable<ResumeRoomResponse["state"]>;

type RichMatchProgressState = NonNullable<ResumeRoomResponse["state"]> & {
  phaseDetail?: string | null;
  activeActionSeatId?: string | null;
  latestTrickResult?: MatchView["trickResults"][number] | null;
  latestTrickResolvedAt?: string | null;
  trickResult?: {
    state?: "idle" | "resolved";
    resolvedAt?: string | null;
    winnerSeatId?: string | null;
    winnerTeamSide?: TeamSide | null;
    winningCardLabel?: string | null;
  } | null;
  handSummary?: {
    state?: "idle" | "resolved";
    resolvedAt?: string | null;
    finalScore?: {
      A: number;
      B: number;
    } | null;
    winnerTeamSide?: TeamSide | null;
    reason?: string | null;
  } | null;
  matchSummary?: {
    state?: "idle" | "resolved";
    resolvedAt?: string | null;
    finalScore?: {
      A: number;
      B: number;
    } | null;
    winnerTeamSide?: TeamSide | null;
    reason?: string | null;
  } | null;
  wildcardSelectionState?: {
    phase?: RoomSnapshot["phase"];
    isPending?: boolean;
    ownerSeatId?: string;
    selectedChoiceId?: string | null;
    selectedChoiceLabel?: string | null;
    availableChoices?: Array<{
      id: string;
      label: string;
    }>;
    responseDeadlineAt?: string | null;
    fixedForEnvido?: boolean;
  } | null;
};

function formatRoomPhaseLabel(phase: RoomLifecycleState): string {
  switch (phase) {
    case "lobby":
      return "Lobby";
    case "ready_check":
      return "Ready check";
    case "dealing":
      return "Dealing";
    case "action_turn":
      return "Action turn";
    case "canto_pending":
      return "Canto pending";
    case "response_pending":
      return "Response pending";
    case "wildcard_selection":
      return "Wildcard selection";
    case "trick_resolution":
      return "Trick resolution";
    case "hand_scoring":
      return "Hand scoring";
    case "reconnect_hold":
      return "Reconnect hold";
    case "match_end":
      return "Match end";
    case "post_match_summary":
      return "Post-match summary";
    default:
      return String(phase);
  }
}

function isResolvedPhase(phase: RoomLifecycleState) {
  return phase === "match_end" || phase === "post_match_summary";
}

function isInteractivePhase(phase: RoomLifecycleState) {
  return phase === "action_turn" || phase === "canto_pending" || phase === "response_pending" || phase === "wildcard_selection";
}

type LifecycleNarrative = {
  roomModeLabel: string;
  roomModeDetail: string;
  lifecycleHeadline: string;
  lifecycleStatus: string;
  reconnectDetail: string;
  cantoDetail: string;
  trickDetail: string;
  handDetail: string;
  summaryDetail: string;
  roomBadge: string;
};

function getLifecycleNarrative({
  phase,
  phaseDetail,
  everybodyReady,
  currentTurnName,
  trickResolved,
  trickResolvedAt,
  handSummaryResolved,
  handSummaryScore,
  handSummaryReason,
  matchSummaryResolved,
  matchSummaryScore,
  matchSummaryReason,
  wildcardSelectionState,
  wildcardPending,
  wildcardResponsePending,
  trickResolutionActive,
  handScoringActive,
  wildcardSelectionActive,
  summaryStateActive,
  isMyTurn,
  score,
  connectionLabel,
}: {
  phase: RoomLifecycleState;
  phaseDetail: string | null;
  everybodyReady: boolean;
  currentTurnName: string | null;
  trickResolved: boolean;
  trickResolvedAt: string | null;
  handSummaryResolved: boolean;
  handSummaryScore: { A: number; B: number } | null;
  handSummaryReason: string | null;
  matchSummaryResolved: boolean;
  matchSummaryScore: { A: number; B: number } | null;
  matchSummaryReason: string | null;
  wildcardSelectionState: RichMatchProgressState["wildcardSelectionState"];
  wildcardPending: boolean;
  wildcardResponsePending: boolean;
  trickResolutionActive: boolean;
  handScoringActive: boolean;
  wildcardSelectionActive: boolean;
  summaryStateActive: boolean;
  isMyTurn: boolean;
  score: { A: number; B: number };
  connectionLabel: string;
}): LifecycleNarrative {
  switch (phase) {
    case "lobby":
      return {
        roomModeLabel: everybodyReady ? "Lobby ready" : "Lobby building",
        roomModeDetail: phaseDetail ?? (everybodyReady
          ? "All seats are set and the host can start the match."
          : "Seat and team setup still needs attention."),
        lifecycleHeadline: phaseDetail ?? (everybodyReady ? "Lobby is ready for the host." : "Lobby setup is still in progress."),
        lifecycleStatus: everybodyReady ? "Ready" : "Setup",
        reconnectDetail: everybodyReady ? "Room synced and checking readiness" : "Bringing the room back",
        cantoDetail: currentTurnName ? `${currentTurnName} can be assigned next` : "Canto surface ready",
        trickDetail: "Trick table is waiting for the opening deal",
        handDetail: "Hand lane is standing by for the first deal",
        summaryDetail: "Summary will only appear after the match closes",
        roomBadge: everybodyReady ? "Match gate open" : "Waiting on seats",
      };
    case "ready_check":
      return {
        roomModeLabel: "Ready check",
        roomModeDetail: phaseDetail ?? (everybodyReady
          ? "All seats are ready and the host can push the match forward."
          : "The table is checking readiness before the first deal."),
        lifecycleHeadline: phaseDetail ?? "The room is validating seats before the deal.",
        lifecycleStatus: everybodyReady ? "Ready" : "Checking",
        reconnectDetail: connectionLabel === "Live" ? "Seat links are verified" : "Seat links are being verified before the match starts",
        cantoDetail: "Canto lane is waiting on the opening action",
        trickDetail: "No trick is open until the deal lands",
        handDetail: "The first hand has not started yet",
        summaryDetail: "Final summary remains dormant until the match ends",
        roomBadge: everybodyReady ? "Gate open" : "Seat checks active",
      };
    case "dealing":
      return {
        roomModeLabel: "Dealing",
        roomModeDetail: phaseDetail ?? "The server is dealing cards and preparing the first action lane.",
        lifecycleHeadline: phaseDetail ?? "Cards are being dealt and the live table is preparing to open.",
        lifecycleStatus: "Dealing",
        reconnectDetail: "Seat state is being restored during the deal",
        cantoDetail: "Canto is not open until the first action arrives",
        trickDetail: "The opening trick is being prepared",
        handDetail: "Hand state will populate after the deal completes",
        summaryDetail: "Summary stays hidden until the hand is complete",
        roomBadge: "Deal in progress",
      };
    case "action_turn":
      return {
        roomModeLabel: isMyTurn ? "Response pending" : "Action turn",
        roomModeDetail: phaseDetail ?? (isMyTurn
          ? "Your seat is active and the server is waiting on your move."
          : currentTurnName
            ? `${currentTurnName} is on the clock.`
            : "The table is live and waiting on the next move."),
        lifecycleHeadline: phaseDetail ?? "The room is live and the action lane is open.",
        lifecycleStatus: isMyTurn ? "Your turn" : "Live",
        reconnectDetail: "Seat sync is live and the action lane is readable",
        cantoDetail: isMyTurn
          ? "Your response is pending on the current call"
          : currentTurnName
            ? `${currentTurnName} can answer the call`
            : "Canto is ready for the next action",
        trickDetail: trickResolutionActive ? "The latest trick is still resolving" : "The trick lane is still open",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : handScoringActive || summaryStateActive ? `Hand settled at ${score.A} - ${score.B}` : "The hand remains open",
        summaryDetail: summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary stays closed until the hand resolves",
        roomBadge: isMyTurn ? "Action pending" : "Live table",
      };
    case "canto_pending":
      return {
        roomModeLabel: "Canto pending",
        roomModeDetail: phaseDetail ?? (isMyTurn
          ? "Your canto response is pending on the server."
          : "A canto response is waiting on the table."),
        lifecycleHeadline: phaseDetail ?? "The room is waiting on a canto response.",
        lifecycleStatus: "Canto",
        reconnectDetail: "Seat sync remains stable while the canto resolves",
        cantoDetail: isMyTurn ? "Your response is pending" : "Another seat is answering the call",
        trickDetail: trickResolutionActive ? "Trick resolution is already visible" : "Trick outcome will follow the canto",
        handDetail: summaryStateActive ? `Hand settled at ${score.A} - ${score.B}` : "Hand scoring will follow the canto lane",
        summaryDetail: summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary remains closed until the hand resolves",
        roomBadge: isMyTurn ? "Response pending" : "Call waiting",
      };
    case "response_pending":
      return {
        roomModeLabel: "Response pending",
        roomModeDetail: phaseDetail ?? (isMyTurn
          ? "Your response is waiting to be confirmed by the server."
          : currentTurnName
            ? `${currentTurnName} is responding.`
            : "The table is waiting on a response."),
        lifecycleHeadline: phaseDetail ?? "The room is waiting for a response to land.",
        lifecycleStatus: isMyTurn ? "Pending" : "Waiting",
        reconnectDetail: "Reconnect stays active while the response is pending",
        cantoDetail: isMyTurn ? "Your seat is being asked to answer" : "The call is waiting for confirmation",
        trickDetail: trickResolutionActive ? "Trick resolution is already visible" : "The trick lane will update after the response",
        handDetail: summaryStateActive ? `Hand settled at ${score.A} - ${score.B}` : "The hand remains open until the response resolves",
        summaryDetail: summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary is blocked behind the response",
        roomBadge: "Response lane",
      };
    case "wildcard_selection":
      return {
        roomModeLabel: wildcardSelectionActive
          ? wildcardResponsePending
            ? "Wildcard pending"
            : "Wildcard selection"
          : "Wildcard lane",
        roomModeDetail: phaseDetail ?? (wildcardSelectionActive
          ? wildcardResponsePending
            ? "Your wildcard choice is waiting on the server."
            : "The wildcard lane is visible and ready to be consumed."
          : "The wildcard shell is ready for the next hand."),
        lifecycleHeadline: phaseDetail ?? "The room is waiting on wildcard selection.",
        lifecycleStatus: wildcardSelectionActive ? (wildcardResponsePending ? "Choose now" : "Selection") : "Selection",
        reconnectDetail: "Seat sync stays readable while the wildcard is selected",
        cantoDetail: wildcardResponsePending ? "Your seat is expected to pick a wildcard" : wildcardSelectionState?.selectedChoiceLabel ? `Choice pinned: ${wildcardSelectionState.selectedChoiceLabel}` : "Wildcard preview is live",
        trickDetail: trickResolutionActive ? "Trick resolution remains visible under the choice" : "Trick flow waits behind the wildcard",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : summaryStateActive ? `Hand settled at ${score.A} - ${score.B}` : "Hand scoring will continue after selection",
        summaryDetail: summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary remains closed until the wildcard lands",
        roomBadge: wildcardSelectionActive
          ? wildcardResponsePending
            ? "Selection pending"
            : "Wildcard lane"
          : "Wildcard lane",
      };
    case "trick_resolution":
      return {
        roomModeLabel: "Trick resolution",
        roomModeDetail: phaseDetail ?? "The server is resolving the current trick.",
        lifecycleHeadline: phaseDetail ?? "The room is resolving the current trick.",
        lifecycleStatus: "Resolving",
        reconnectDetail: "Seat sync stays active while the trick settles",
        cantoDetail: "Canto lane is closed until the trick result lands",
        trickDetail: trickResolutionActive ? "The trick is still resolving" : trickResolved ? `Resolved at ${trickResolvedAt ?? "server time"}` : "The latest trick result is visible",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : handScoringActive || summaryStateActive ? `Hand settled at ${score.A} - ${score.B}` : "The hand will continue scoring after the trick resolves",
        summaryDetail: matchSummaryResolved && matchSummaryScore ? `Final score ${matchSummaryScore.A} - ${matchSummaryScore.B}` : summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary is waiting behind the trick result",
        roomBadge: "Trick resolving",
      };
    case "hand_scoring":
      return {
        roomModeLabel: "Hand scoring",
        roomModeDetail: phaseDetail ?? "The server is scoring the hand now.",
        lifecycleHeadline: phaseDetail ?? "The hand is being scored before the match advances.",
        lifecycleStatus: summaryStateActive ? "Scored" : "Scoring",
        reconnectDetail: "Reconnect remains stable while the hand score settles",
        cantoDetail: "Canto is no longer the active lane",
        trickDetail: trickResolved ? `Resolved at ${trickResolvedAt ?? "server time"}` : trickResolutionActive ? "Latest trick result remains visible" : "Trick results feed the hand score",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : "The hand score is being finalized",
        summaryDetail: matchSummaryResolved && matchSummaryScore ? `Final score ${matchSummaryScore.A} - ${matchSummaryScore.B}` : summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary will unlock after scoring",
        roomBadge: "Scoring hand",
      };
    case "reconnect_hold":
      return {
        roomModeLabel: "Reconnect hold",
        roomModeDetail: phaseDetail ?? "The room is holding the seat while the connection settles.",
        lifecycleHeadline: phaseDetail ?? "The room is holding state while the seat reconnects.",
        lifecycleStatus: "Hold",
        reconnectDetail: "Seat is held while the connection settles",
        cantoDetail: "Canto waits until the socket comes back",
        trickDetail: trickResolved ? "Resolved trick remains visible during reconnect" : "Trick details are paused during reconnect",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : summaryStateActive ? `Hand settled at ${score.A} - ${score.B}` : "Hand state will resume after reconnect",
        summaryDetail: matchSummaryResolved && matchSummaryScore ? `Final score ${matchSummaryScore.A} - ${matchSummaryScore.B}` : summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary remains intact during reconnect",
        roomBadge: "Seat held",
      };
    case "match_end":
      return {
        roomModeLabel: "Match end",
        roomModeDetail: phaseDetail ?? "The match has ended and the settled result is being surfaced.",
        lifecycleHeadline: phaseDetail ?? "The match has closed and the summary is ready to read.",
        lifecycleStatus: summaryStateActive ? "Ended" : "Finalizing",
        reconnectDetail: "Reconnect is still possible from the settled room",
        cantoDetail: "Canto is closed after the final hand",
        trickDetail: trickResolved ? `Resolved at ${trickResolvedAt ?? "server time"}` : trickResolutionActive ? "The last trick remains visible in history" : "Trick history is settled",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : "Hand scoring completed the match",
        summaryDetail: matchSummaryResolved && matchSummaryScore ? `Final score ${matchSummaryScore.A} - ${matchSummaryScore.B}` : "Final summary is being surfaced",
        roomBadge: summaryStateActive ? "Settled" : "Match over",
      };
    case "post_match_summary":
      return {
        roomModeLabel: "Post-match summary",
        roomModeDetail: phaseDetail ?? "The final summary is the active room state.",
        lifecycleHeadline: phaseDetail ?? "The room is in post-match summary mode.",
        lifecycleStatus: summaryStateActive ? "Summary" : "Settled",
        reconnectDetail: "Reconnect can still bring the settled room back into view",
        cantoDetail: "Canto lane is closed in summary mode",
        trickDetail: trickResolved ? `Resolved at ${trickResolvedAt ?? "server time"}` : trickResolutionActive ? "Resolved trick history remains visible" : "Trick history is fully settled",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : "The hand is complete and summarized",
        summaryDetail: matchSummaryResolved && matchSummaryScore ? `Final score ${matchSummaryScore.A} - ${matchSummaryScore.B}` : summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary state is waiting to be filled",
        roomBadge: summaryStateActive ? "Summary" : "Settled",
      };
    default:
      return {
        roomModeLabel: formatRoomPhaseLabel(phase),
        roomModeDetail: phaseDetail ?? "The room is moving through the next lifecycle step.",
        lifecycleHeadline: phaseDetail ?? "The room is moving through the next lifecycle step.",
        lifecycleStatus: formatRoomPhaseLabel(phase),
        reconnectDetail: connectionLabel,
        cantoDetail: currentTurnName ? `${currentTurnName} is eligible to act` : "Canto shell is ready",
        trickDetail: trickResolved ? `Resolved at ${trickResolvedAt ?? "server time"}` : trickResolutionActive ? "Trick result is visible" : "Trick lane is open",
        handDetail: handSummaryResolved && handSummaryScore ? `Hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}` : summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Hand is still open",
        summaryDetail: matchSummaryResolved && matchSummaryScore ? `Final score ${matchSummaryScore.A} - ${matchSummaryScore.B}` : summaryStateActive ? `Final score ${score.A} - ${score.B}` : "Summary will appear later",
        roomBadge: "Live",
      };
  }
}

export function LobbyClient({ code }: { code: string }) {
  const normalizedCode = useMemo(() => code.toUpperCase(), [code]);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [matchView, setMatchView] = useState<MatchView | null>(null);
  const [matchState, setMatchState] = useState<RichMatchProgressState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomSessionToken, setRoomSessionToken] = useState<string | null>(null);
  const [connectionLabel, setConnectionLabel] = useState("Connecting...");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const token = window.localStorage.getItem(getSessionStorageKey(normalizedCode));
    setRoomSessionToken(token);

    if (!token) {
      setError("This browser does not have a session for this room yet. Create or join from home first.");
      setLoading(false);
      return;
    }

    let activeSocket: Socket | null = null;

    const refreshRoomState = async () => {
      setConnectionLabel("Syncing room...");
      const response = await fetch(
        `${apiBaseUrl}/rooms/${normalizedCode}?roomSessionToken=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = (await response.json()) as ResumeRoomResponse;
      setSnapshot(result.snapshot);
      setSession(result.session);
      setMatchView(result.matchView);
      setMatchState(result.state as RichMatchProgressState | null);
      setLoading(false);
    };

    const syncRoomState = ({
      snapshot: nextSnapshot,
      matchView: nextMatchView,
      state: nextState,
      session: nextSession,
    }: {
      snapshot: RoomSnapshot;
      matchView: MatchView | null;
      state: ResumeRoomResponse["state"];
      session?: RoomSession | null;
    }) => {
      setSnapshot(nextSnapshot);
      setMatchView(nextMatchView);
      setMatchState(nextState as RichMatchProgressState | null);
      if (typeof nextSession !== "undefined") {
        setSession(nextSession);
      }
      setLoading(false);
      setError(null);
    };

    const hydrateRoom = async () => {
      try {
        await refreshRoomState();

        activeSocket = io(`${socketBaseUrl}/game`, {
          transports: ["websocket"],
        });
        setSocket(activeSocket);

        activeSocket.on("connect", () => {
          setConnectionLabel("Live");
          activeSocket?.emit("room:join", {
            roomCode: normalizedCode,
            roomSessionToken: token,
          });
        });

        activeSocket.on("disconnect", () => {
          setConnectionLabel("Reconnecting...");
        });

        activeSocket.on("connect_error", () => {
          setConnectionLabel("Offline");
        });

        activeSocket.on("room:joined", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("room:updated", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("session:recovered", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
            session: payload.session,
          });
        });

        activeSocket.on("action:submitted", (payload) => {
          if (!payload.snapshot) {
            return;
          }

          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("action:rejected", (payload) => {
          if (!payload.snapshot) {
            return;
          }

          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("canto:opened", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("canto:resolved", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("wildcard:selection-required", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("wildcard:selected", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("trick:resolved", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("hand:scored", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("summary:started", (payload) => {
          syncRoomState({
            snapshot: payload.snapshot,
            matchView: payload.matchView,
            state: payload.state,
          });
        });

        activeSocket.on("room:snapshot", () => {
          void refreshRoomState();
        });
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load room.");
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
      throw new Error("Socket connection is not ready yet.");
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
        throw new Error(response.message ?? "Action failed.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Action failed.");
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
      <ConnectionStateCard
        eyebrow="Room sync"
        title={`Loading room ${normalizedCode}`}
        description="We are restoring your seat, reconnecting the socket, and pulling the latest room state from the server."
        status={connectionLabel}
        tone="cyan"
        details={[
          "Recovering the stored seat token",
          "Refreshing the latest room snapshot",
          "Reopening the socket connection",
        ]}
        steps={["Read local session", "Load room snapshot", "Open live socket"]}
        activeStepIndex={1}
        primaryAction={{ label: "Retry now", onClick: retryRoomLoad }}
        secondaryAction={{ label: "Open manual", href: "/manual" }}
      />
    );
  }

  if (error && !snapshot) {
    return (
      <ConnectionStateCard
        eyebrow="Room recovery"
        title={`We could not restore room ${normalizedCode}.`}
        description="If you already joined this room from another browser tab, the local session may have expired. Go back to the home screen, rejoin with the room code, or open the manual if you need the play flow again."
        status={connectionLabel}
        tone="rose"
        details={[
          error,
          "Seat-based sessions are stored in local browser state for now.",
          "Use retry after reopening the room or returning from home.",
        ].filter((item): item is string => Boolean(item))}
        steps={["Check local session", "Retry fetch", "Reconnect room"]}
        activeStepIndex={1}
        primaryAction={roomSessionToken ? { label: "Try reconnecting", onClick: retryRoomLoad } : undefined}
        secondaryAction={{ label: "Back home", href: "/" }}
      />
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

  const score = matchView?.score ?? snapshot.score;
  const activeEvents = matchView?.recentEvents ?? snapshot.recentEvents;
  const lifecycleState: RoomLifecycleState = matchState ?? snapshot.phase;
  const phaseDetail = matchState?.phaseDetail ?? null;
  const activeActionSeatId = matchState?.activeActionSeatId ?? matchView?.currentTurnSeatId ?? null;
  const trickResolvedAt = matchState?.trickResult?.resolvedAt ?? matchState?.latestTrickResolvedAt ?? null;
  const trickResolved = matchState?.trickResult?.state === "resolved";
  const handSummaryResolved = matchState?.handSummary?.state === "resolved";
  const handSummaryScore = matchState?.handSummary?.finalScore ?? null;
  const handSummaryReason = matchState?.handSummary?.reason ?? null;
  const matchSummaryResolved = matchState?.matchSummary?.state === "resolved";
  const matchSummaryScore = matchState?.matchSummary?.finalScore ?? null;
  const matchSummaryReason = matchState?.matchSummary?.reason ?? null;
  const wildcardSelectionState = matchState?.wildcardSelectionState ?? null;
  const wildcardSelectionPhase = wildcardSelectionState?.phase ?? lifecycleState;
  const wildcardSelectionOwnerName = wildcardSelectionState?.ownerSeatId
    ? snapshot.seats.find((seat) => seat.id === wildcardSelectionState.ownerSeatId)?.displayName ?? "Unknown"
    : null;
  const currentTurnName =
    activeActionSeatId
      ? snapshot.seats.find((seat) => seat.id === activeActionSeatId)?.displayName ?? "Unknown"
      : null;
  const currentTrickResult = matchState?.latestTrickResult ?? matchView?.trickResults[matchView.trickResults.length - 1] ?? null;
  const currentWildcard = matchView?.yourHand.find((card) => card.isWildcard) ?? null;
  const wildcardCount = matchView?.yourHand.filter((card) => card.isWildcard).length ?? 0;
  const trickResolutionActive = lifecycleState === "trick_resolution";
  const handScoringActive = lifecycleState === "hand_scoring";
  const wildcardSelectionActive = lifecycleState === "wildcard_selection";
  const wildcardSelectionPhaseActive = wildcardSelectionPhase === "wildcard_selection";
  const summaryStateActive = isResolvedPhase(lifecycleState) || matchSummaryResolved;
  const wildcardResponsePending = wildcardSelectionPhaseActive
    ? wildcardSelectionState?.isPending ??
      (((wildcardSelectionState?.ownerSeatId ?? activeActionSeatId) === currentSeat?.id && Boolean(currentWildcard)) || !currentWildcard)
    : false;
  const isMyTurn = lifecycleState === "action_turn" && activeActionSeatId === currentSeat?.id;
  const cantoAttentionLabel = isMyTurn
    ? "Response pending"
    : lifecycleState === "action_turn"
      ? "Waiting on another seat"
      : "Ready for canto";
  const cantoAttentionDescription = isMyTurn
    ? "Your seat is active. The shell will stay highlighted until a real canto response arrives from the server."
    : lifecycleState === "action_turn"
      ? "Another seat is responding right now, so this lane stays informative without asking you for input."
      : "Canto is available as a visual shell, ready for the next match phase.";
  const wildcardPromptOptions = wildcardSelectionState?.availableChoices?.length
    ? wildcardSelectionState.availableChoices.map((choice, index) => ({
        label: choice.label,
        detail:
          wildcardSelectionState.fixedForEnvido && index === 0
            ? "Pinned for envido and carried through the selection lane."
            : index === 0
              ? "Primary choice from the server-side wildcard lane."
              : "Alternative choice from the server-side wildcard lane.",
        recommended: choice.id === wildcardSelectionState.selectedChoiceId || index === 0,
      }))
    : currentWildcard
      ? [
          { label: "High value", detail: "Treat the wildcard as the strongest available read.", recommended: true },
          { label: "Low value", detail: "Keep the wildcard conservative for the current line." },
          { label: "Hold for envido", detail: "Reserve the wildcard for a later canto decision." },
        ]
    : [
        { label: "Await selection", detail: "The backend can populate wildcard choices here later.", recommended: true },
        { label: "Preview mode", detail: "This shell can render any future wildcard event payload." },
      ];
  const wildcardFlowSteps =
    wildcardSelectionPhase === "wildcard_selection" && wildcardResponsePending
      ? ["Detect wildcard", "Preview candidate", "Lock choice"]
      : wildcardSelectionPhase === "wildcard_selection"
        ? ["Detect wildcard", "Preview candidate", "Waiting for turn"]
        : currentWildcard
          ? ["Detect wildcard", "Preview candidate", "Preview lane ready"]
          : ["No wildcard yet", "Preview lane ready", "Await server data"];
  const wildcardFlowIndex = wildcardSelectionActive
    ? wildcardResponsePending
      ? 1
      : wildcardSelectionState?.selectedChoiceId || wildcardSelectionState?.selectedChoiceLabel
        ? 2
        : 1
    : currentWildcard
      ? isMyTurn
        ? 1
        : 2
      : 0;
  const wildcardFlowLabel = wildcardSelectionActive
    ? wildcardResponsePending
      ? "Your wildcard choice is pending"
      : wildcardSelectionState?.selectedChoiceLabel
        ? "Wildcard choice pinned"
        : "Wildcard preview is live"
    : currentWildcard
      ? isMyTurn
        ? "Your wildcard choice is pending"
        : "Wildcard preview is live"
      : "Wildcard lane idle";
  const wildcardStatusLabel = wildcardSelectionActive
    ? wildcardResponsePending
      ? "Choose now"
      : wildcardSelectionState?.selectedChoiceLabel
        ? "Selection pinned"
        : "Selection preview"
    : currentWildcard
      ? isMyTurn
        ? "Choose now"
        : "Selection preview"
      : "Awaiting wildcard";
  const wildcardAttentionLabel = wildcardSelectionActive
    ? wildcardResponsePending
      ? "Ready to choose"
      : wildcardSelectionState?.fixedForEnvido
        ? "Fixed for envido"
        : wildcardSelectionState?.selectedChoiceLabel
          ? "Choice pinned"
          : "Preview only"
    : currentWildcard
      ? isMyTurn
        ? "Ready to choose"
        : "Preview only"
      : "Wildcard shell ready";
  const wildcardAttentionDescription = wildcardSelectionActive
    ? wildcardResponsePending
      ? wildcardSelectionState?.fixedForEnvido
        ? "The room is in wildcard selection mode, and the wildcard stays fixed for envido while the server confirms the choice."
        : "The room is in wildcard selection mode, and this shell is waiting for the server to confirm the choice."
      : wildcardSelectionState?.selectedChoiceLabel
        ? `The room has pinned ${wildcardSelectionState.selectedChoiceLabel} to the wildcard lane${wildcardSelectionOwnerName ? ` for ${wildcardSelectionOwnerName}` : ""}.`
        : wildcardSelectionPhase === "wildcard_selection"
          ? "The room is in wildcard selection mode, and the prompt stays visible until the active seat chooses."
          : "The wildcard shell is ready and will follow the selection payload when it arrives."
    : currentWildcard
      ? isMyTurn
        ? "Your current hand has a wildcard, and this shell is asking for the real choice once the backend exposes it."
        : "A wildcard is present in your hand, and the room is keeping the preview visible until your seat is active."
      : "No wildcard choice is active yet, but the UI already has a dedicated spot for it.";
  const wildcardPending = Boolean(currentWildcard && isMyTurn);
  const trickResolutionLabel = trickResolved
    ? matchState?.trickResult?.winnerTeamSide
      ? `Team ${matchState.trickResult.winnerTeamSide} won the trick.`
      : currentTrickResult
        ? currentTrickResult.winnerTeamSide
          ? `Team ${currentTrickResult.winnerTeamSide} won trick ${currentTrickResult.trickNumber}.`
          : `Trick ${currentTrickResult.trickNumber} ended in a tie.`
        : "The trick resolved."
    : currentTrickResult
      ? currentTrickResult.winnerTeamSide
        ? `Team ${currentTrickResult.winnerTeamSide} won trick ${currentTrickResult.trickNumber}.`
        : `Trick ${currentTrickResult.trickNumber} ended in a tie.`
      : trickResolutionActive
        ? "The server is still resolving the current trick."
        : "The next trick result will be shown here.";
  const handResolutionLabel = handSummaryResolved && handSummaryScore
    ? `The hand settled at ${handSummaryScore.A} - ${handSummaryScore.B}.${handSummaryReason ? ` ${handSummaryReason}` : ""}`
    : summaryStateActive
      ? `The hand settled at ${score.A} - ${score.B}.`
      : handScoringActive
        ? "The server is still scoring the hand."
        : "Hand resolution is waiting for a completed set of tricks.";
  const trickLaneState = trickResolutionActive ? "resolving" : handScoringActive || summaryStateActive || trickResolved ? "resolved" : "pending";
  const trickStateLabel = trickResolutionActive ? "Trick resolving" : handScoringActive || summaryStateActive || trickResolved ? "Trick resolved" : "Trick pending";
  const trickContextLabel = `Hand ${matchView?.handNumber ?? "-"}`;
  const trickProgressLabel = currentTrickResult
    ? trickResolved
      ? `Resolved ${trickResolvedAt ?? "server time"}`
      : `Winner ${currentTrickResult.winnerTeamSide ?? "tie"}`
    : trickResolutionActive
      ? "Resolving"
      : `${matchView?.trickResults.length ?? 0} resolved`;
  const handLaneState = summaryStateActive ? "complete" : handScoringActive ? "scoring" : "pending";
  const handStateLabel = summaryStateActive ? "Hand complete" : handScoringActive ? "Hand scoring" : "Hand in progress";
  const handContextLabel = `Target ${snapshot.targetScore}`;
  const handProgressLabel = handSummaryResolved && handSummaryScore
    ? handSummaryReason
      ? `Final ${handSummaryScore.A} - ${handSummaryScore.B} (${handSummaryReason})`
      : `Final ${handSummaryScore.A} - ${handSummaryScore.B}`
    : summaryStateActive
      ? `Final ${score.A} - ${score.B}`
      : handScoringActive
        ? "Scoring"
        : `${matchView?.trickResults.length ?? 0} tricks resolved`;
  const phaseLabel = formatRoomPhaseLabel(lifecycleState);
  const lifecycleNarrative = getLifecycleNarrative({
    phase: lifecycleState,
    phaseDetail,
    everybodyReady,
    currentTurnName,
    trickResolved,
    trickResolvedAt,
    handSummaryResolved,
    handSummaryScore,
    handSummaryReason,
    matchSummaryResolved,
    matchSummaryScore,
    matchSummaryReason,
    wildcardSelectionState,
    wildcardPending,
    wildcardResponsePending,
    trickResolutionActive,
    handScoringActive,
    wildcardSelectionActive,
    summaryStateActive,
    isMyTurn,
    score,
    connectionLabel,
  });
  const {
    roomModeLabel,
    roomModeDetail,
    lifecycleHeadline,
    lifecycleStatus,
    roomBadge,
    reconnectDetail,
    cantoDetail,
    trickDetail,
    handDetail,
    summaryDetail,
  } = lifecycleNarrative;
  const connectionStepIndex =
    connectionLabel === "Live" ? 2 : connectionLabel === "Reconnecting..." || connectionLabel === "Offline" ? 1 : 0;
  const lifecycleItems: LifecycleItem[] =
    lifecycleState !== "lobby"
      ? [
          {
            label: "Reconnect",
            detail: reconnectDetail,
            tone: connectionLabel === "Live" ? "emerald" : "amber",
            active: connectionLabel !== "Live",
            done: connectionLabel === "Live",
          },
          {
            label: "Canto",
            detail: cantoDetail,
            tone: isMyTurn ? "amber" : "cyan",
            active: isInteractivePhase(lifecycleState),
            done: false,
          },
          {
            label: "Trick",
            detail: trickDetail,
            tone: trickResolutionActive || handScoringActive || summaryStateActive ? "emerald" : "cyan",
            active: trickResolutionActive || !trickResolved,
            done: trickResolved || handScoringActive || summaryStateActive,
          },
          {
            label: "Hand",
            detail: handDetail,
            tone: summaryStateActive ? "emerald" : "amber",
            active: handScoringActive || summaryStateActive,
            done: summaryStateActive,
          },
          {
            label: "Summary",
            detail: summaryDetail,
            tone: summaryStateActive ? "emerald" : "amber",
            active: summaryStateActive,
            done: summaryStateActive,
          },
        ]
      : [
          {
            label: "Reconnect",
            detail:
              everybodyReady
                ? "Room synced and checking readiness"
                : connectionLabel === "Live"
                  ? "Room synced"
                  : "Bringing the room back",
            tone: connectionLabel === "Live" ? "emerald" : "amber",
            active: connectionLabel !== "Live",
            done: connectionLabel === "Live",
          },
          {
            label: "Ready",
            detail:
              currentSeat
                ? currentSeat.isReady
                  ? "Marked ready"
                  : "Tap to ready up"
                : "Seat pending",
            tone: currentSeat?.isReady ? "emerald" : "cyan",
            active: Boolean(currentSeat && !currentSeat.isReady),
            done: Boolean(currentSeat?.isReady),
          },
          {
            label: "Teams",
            detail: teamsBalanced ? "Balanced roster" : "Host can rebalance",
            tone: teamsBalanced ? "emerald" : "amber",
            active: !teamsBalanced,
            done: teamsBalanced,
          },
          {
            label: "Start",
            detail: everybodyReady ? "Match gate open" : "Waiting on seats",
            tone: everybodyReady ? "emerald" : "rose",
            active: !everybodyReady,
            done: everybodyReady,
          },
        ];

  if (lifecycleState !== "lobby") {
    return (
      <div className="space-y-6">
        {summaryStateActive ? (
          <ConnectionStateCard
            eyebrow="Post-match state"
            title={`Room ${snapshot.code} is settled.`}
            description="The match has a final score, the room remains readable for reconnection, and the summary stays visible while players decide their next move."
            status={roomBadge}
            tone="emerald"
            details={[
              `Final score ${score.A} - ${score.B}`,
              "The settled room is waiting for the next decision.",
              "The room can still reconnect after the final whistle.",
            ]}
            steps={["Reconnect seat", "Review final score", "Return home or replay later"]}
            activeStepIndex={connectionStepIndex}
            primaryAction={{ label: "Back home", href: "/" }}
            secondaryAction={{ label: "Read manual", href: "/manual" }}
          />
        ) : null}

        <LifecycleRail
          title="Lifecycle"
          subtitle={lifecycleHeadline}
          statusLabel={roomBadge}
          items={lifecycleItems}
        />

        <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Table</p>
                <h1 className="mt-3 text-4xl font-semibold text-white">{snapshot.code}</h1>
                <p className="mt-3 text-sm text-slate-300">{roomModeDetail}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200/78">
                {roomBadge}
              </div>
            </div>

            {connectionLabel !== "Live" ? (
              <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
                Reconnecting automatically. If this stays stuck, use the retry button or reopen the room from home.
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
              <ScorePanel label="Live score" teamA={score.A} teamB={score.B} />
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                <p className="mt-3 text-sm text-slate-200/80">{phaseDetail ?? lifecycleHeadline}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{phaseLabel}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p>Turn deadline: {matchView?.turnDeadlineAt ?? snapshot.turnDeadlineAt ?? "n/a"}</p>
                  <p>Reconnect hold: {matchView?.reconnectDeadlineAt ?? snapshot.reconnectDeadlineAt ?? "n/a"}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Room mode</p>
                <p className="mt-2 text-base font-semibold text-white">{roomModeLabel}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{roomModeDetail}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current turn</p>
                <p className="mt-2 text-base font-semibold text-white">{currentTurnName ?? "No active seat"}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {isMyTurn
                    ? "Your seat is active and the action lane is waiting on your move."
                    : currentTurnName
                      ? "Another seat is leading the live turn."
                      : "The table is between actions."}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Wildcard lane</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {wildcardSelectionActive
                    ? wildcardResponsePending
                      ? "Selection pending"
                      : "Selection ready"
                    : currentWildcard
                      ? wildcardPending
                        ? "Selection pending"
                        : "Selection ready"
                      : "No wildcard yet"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {wildcardSelectionActive
                    ? wildcardResponsePending
                      ? "This hand is in wildcard selection mode and the prompt remains highlighted until the server confirms the choice."
                      : "The room is already in wildcard selection mode, and the choice shell is standing by."
                    : currentWildcard
                      ? wildcardPending
                        ? "This hand has a wildcard and the prompt remains highlighted until the selection lands."
                        : "The wildcard is visible and the choice shell is standing by."
                      : "The lane stays ready for the next wildcard without distracting from the table."}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lifecycle readout</p>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Reconnect, canto, trick, hand, and summary are staged together so richer payloads can slot in later.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  {roomBadge}
                </span>
              </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: "Reconnect", value: connectionLabel === "Live" ? "Live" : roomBadge, tone: connectionLabel === "Live" ? "emerald" : "amber" },
                  { label: "Phase", value: phaseLabel, tone: summaryStateActive ? "emerald" : isInteractivePhase(lifecycleState) ? "amber" : "cyan" },
                  { label: "Action", value: lifecycleStatus, tone: isMyTurn ? "amber" : "cyan" },
                  { label: "Trick", value: trickResolutionActive ? "Resolving" : trickResolved ? "Resolved" : "Open", tone: trickResolutionActive || trickResolved ? "amber" : "cyan" },
                  { label: "Summary", value: summaryStateActive ? "Ready" : "Live", tone: summaryStateActive ? "emerald" : "cyan" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      item.tone === "emerald"
                        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                        : item.tone === "amber"
                          ? "border-amber-300/20 bg-amber-300/10 text-amber-50"
                          : item.tone === "rose"
                            ? "border-rose-300/20 bg-rose-300/10 text-rose-50"
                            : "border-cyan-300/20 bg-cyan-300/10 text-cyan-50"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{item.label}</p>
                    <p className="mt-2 text-base font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
            <CantoStateShell
              eyebrow="Canto lane"
              title="Call, answer, or hold."
              description="This shell can represent truco, envido, and later canto states without requiring the backend to emit a dedicated event yet."
              stageLabel={phaseLabel}
              callLabel={
                isMyTurn
                  ? "Your response is pending"
                  : currentTurnName
                    ? `${currentTurnName} is eligible to act`
                    : "Awaiting the next call"
              }
              responseLabel={matchView?.statusText ?? "Server response will appear here"}
              attentionLabel={cantoAttentionLabel}
              attentionDescription={cantoAttentionDescription}
              responsePending={isMyTurn}
              options={[
                { label: "Truco", detail: "Main canto lane for the table.", tone: "cyan" },
                { label: "Envido", detail: "Score-pressure prompt for the current hand.", tone: "amber" },
                { label: "BONG", detail: "Social metadata lane for match flavor.", tone: "emerald" },
              ]}
                footnote="The control surface is presentational only for now. Real canto semantics can slot into this shell later."
              />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {snapshot.seats.map((seat) => (
                <article
                  key={seat.id}
                  className={`rounded-3xl border p-5 text-slate-100 ${
                    activeActionSeatId === seat.id
                      ? "border-cyan-300/40 bg-cyan-300/10"
                      : "border-white/10 bg-slate-900/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm uppercase tracking-[0.22em] text-slate-400">
                      Seat {seat.seatIndex + 1}
                    </p>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      Team {seat.teamSide ?? "-"}
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-semibold">{seat.displayName ?? "Open seat"}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {activeActionSeatId === seat.id ? "Turn now" : "Waiting"} - {seat.handCount} cards left
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Trick table</p>
              <p className="text-sm text-slate-300">
                Hand {matchView?.handNumber ?? "-"} - Trick {matchView?.trickNumber ?? "-"}
              </p>
            </div>

            {matchView && matchView.tableCards.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {matchView.tableCards.map((play) => (
                  <div
                    key={`${play.seatId}-${play.card.id}`}
                    className="rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-4"
                  >
                    <p className="text-sm text-slate-400">{play.displayName}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{play.card.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                {currentTurnName ? `${currentTurnName} is leading this trick.` : "Waiting for the next trick."}
              </p>
            )}
          </div>

          <ResolutionBanner
            kind="trick"
            title={
              lifecycleState === "trick_resolution"
                ? "Trick resolving"
                : trickResolved || handScoringActive || summaryStateActive
                  ? "Trick resolved"
                  : "Trick waiting on the table."
            }
            summary={
              lifecycleState === "trick_resolution"
                ? "The room is in trick resolution mode and the banner is waiting on the authoritative result."
                : trickResolved || handScoringActive || summaryStateActive
                  ? trickResolvedAt
                    ? "The latest trick has resolved and the banner stays readable while the recap fields settle."
                    : "The latest trick has a clear winner and the banner makes the outcome easy to scan."
                  : "The trick lane is still open, but the UI already shows the state the moment a result lands."
            }
            outcome={trickResolutionLabel}
            tone={lifecycleState === "trick_resolution" ? "amber" : trickResolved || handScoringActive || summaryStateActive ? "emerald" : "cyan"}
            stateLabel={trickStateLabel}
            contextLabel={trickContextLabel}
            progressLabel={trickProgressLabel}
            stateTone={lifecycleState === "trick_resolution" ? "amber" : trickResolved || handScoringActive || summaryStateActive ? "emerald" : "cyan"}
            details={[
              `Resolution lane: ${trickLaneState}`,
              `Trick ${matchView?.trickNumber ?? "-"}`,
              matchState?.trickResult?.winningCardLabel
                ? `Winning card ${matchState.trickResult.winningCardLabel}`
                : currentTrickResult?.winningCardLabel
                  ? `Winning card ${currentTrickResult.winningCardLabel}`
                  : "Waiting for winner card",
              trickResolvedAt ? `Resolved at ${trickResolvedAt}` : "Awaiting trick resolve timestamp",
            ]}
          />

          <EventFeed title="Recent events" events={activeEvents} />

          {summaryStateActive ? (
            <MatchSummaryPanel
              roomCode={snapshot.code}
              targetScore={snapshot.targetScore}
              winnerTeamSide={matchState?.matchSummary?.winnerTeamSide ?? matchView?.summary?.winnerTeamSide}
              finalScore={matchState?.matchSummary?.finalScore ?? matchView?.summary?.finalScore}
              stateLabel={summaryStateActive ? "Summary ready" : "Summary pending"}
              phaseLabel={phaseDetail ?? phaseLabel}
              reason={matchSummaryReason}
            />
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200/70">Your hand</p>
            <p className="mt-3 text-sm text-slate-300">
              {matchView?.yourTeamSide ? `You are on Team ${matchView.yourTeamSide}.` : "Seat pending."}
            </p>

            {matchView ? (
              <div className="mt-6 space-y-3">
                {matchView.yourHand.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                  disabled={
                      actionPending ||
                      lifecycleState !== "action_turn" ||
                      activeActionSeatId !== currentSeat?.id
                    }
                    onClick={() => handlePlayCard(card.id)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-4 text-left text-slate-100 transition hover:border-cyan-300/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-lg font-semibold">{card.label}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {card.isWildcard ? "Wildcard" : `${card.rank} - ${card.suit}`}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-300">Building your table view...</p>
            )}
          </div>

          <div className="rounded-[2rem] border border-amber-300/20 bg-amber-300/10 p-4 shadow-2xl shadow-amber-950/20 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-100/80">Wildcard readiness</p>
                <p className="mt-2 text-sm text-amber-50/90">
                  {wildcardCount > 0
                    ? `${wildcardCount} wildcard${wildcardCount > 1 ? "s" : ""} in hand, ready to preview.`
                    : "No wildcard in hand yet, but the selection lane is already prepared."}
                </p>
              </div>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-50">
                {wildcardFlowLabel}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {wildcardFlowSteps.map((step, index) => {
                const isActive = index === wildcardFlowIndex;
                const isDone = index < wildcardFlowIndex;
                return (
                  <div
                    key={step}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      isActive
                        ? "border-amber-200/30 bg-amber-200/10 text-white"
                        : isDone
                          ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                          : "border-white/10 bg-slate-950/80 text-slate-300"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                      {isDone ? "Done" : isActive ? "Active" : "Queued"}
                    </p>
                    <p className="mt-2">{step}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <WildcardPromptShell
            eyebrow="Wildcard prompt"
            title={
              wildcardSelectionPhaseActive
                ? wildcardResponsePending
                  ? wildcardSelectionOwnerName
                    ? `Wildcard choice pending for ${wildcardSelectionOwnerName}.`
                    : "Wildcard choice pending."
                  : wildcardSelectionState?.selectedChoiceLabel
                    ? `Select how ${wildcardSelectionState.selectedChoiceLabel} should read.`
                    : currentWildcard
                    ? "Select how the wildcard should read."
                    : "Wildcard selection live."
                : currentWildcard
                  ? "Select how the wildcard should read."
                  : "Wildcard lane standing by."
            }
            description={
              wildcardSelectionPhaseActive
                ? wildcardResponsePending
                  ? "The room is in wildcard selection mode and the shell is waiting on the authoritative choice."
                  : wildcardSelectionState?.selectedChoiceLabel
                    ? `The room is in wildcard selection mode and the shell is reflecting ${wildcardSelectionState.selectedChoiceLabel}.`
                    : "The room is in wildcard selection mode and the shell is ready to reflect the active choice."
                : currentWildcard
                  ? "This shell keeps the current wildcard choice visible, with a selection flow that can be wired to real backend events later."
                  : "This shell stays ready for the next wildcard and keeps the choice lane visible without blocking the rest of the table."
            }
            statusLabel={wildcardStatusLabel}
            flowLabel={wildcardFlowLabel}
            flowSteps={wildcardFlowSteps}
            activeFlowStep={wildcardFlowIndex}
            selectedLabel={
              wildcardSelectionPhaseActive
                ? wildcardResponsePending
                  ? wildcardSelectionOwnerName
                    ? `Selection pending for ${wildcardSelectionOwnerName}`
                    : "Selection pending"
                  : wildcardSelectionState?.selectedChoiceLabel ?? currentWildcard?.label ?? "Wildcard selection"
                : currentWildcard?.label ?? "No wildcard selected"
            }
            attentionLabel={wildcardAttentionLabel}
            attentionDescription={wildcardAttentionDescription}
            highlightSelected={wildcardSelectionPhaseActive ? wildcardResponsePending || Boolean(currentWildcard) : Boolean(currentWildcard)}
            responsePending={wildcardResponsePending}
            options={wildcardPromptOptions}
            footnote={
              wildcardSelectionState?.responseDeadlineAt
                ? `When the server starts emitting real wildcard events, this shell can stay in place and simply receive props. Deadline ${wildcardSelectionState.responseDeadlineAt}.`
                : "When the server starts emitting real wildcard events, this shell can stay in place and simply receive props."
            }
          />

          <div className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-amber-950/20 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200/70">Trick history</p>
            <div className="mt-4 space-y-3">
              {(matchView?.trickResults ?? []).map((trick) => (
                <div
                  key={trick.trickNumber}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200/82"
                >
                  Trick {trick.trickNumber}:{" "}
                  {trick.winnerTeamSide
                    ? `Team ${trick.winnerTeamSide} by ${trick.winningCardLabel ?? "card"}`
                    : "Tie"}
                </div>
              ))}
              {matchView && matchView.trickResults.length === 0 ? (
                <p className="text-sm text-slate-300">No resolved tricks yet.</p>
              ) : null}
            </div>
          </div>

          <ResolutionBanner
            kind="hand"
            title={summaryStateActive ? "Hand complete" : handScoringActive ? "Hand scoring" : "Hand still in progress"}
            summary={
              summaryStateActive
                ? "The room is in a settled hand phase and is ready for the final recap lane."
                : handScoringActive
                  ? "The final hand state is clear and the room can stay open for a reconnect or replay decision."
                  : "The hand lane keeps the current score and trick progress visible before the final result arrives."
            }
            outcome={handResolutionLabel}
            tone={summaryStateActive ? "emerald" : handScoringActive ? "amber" : "amber"}
            stateLabel={handStateLabel}
            contextLabel={handContextLabel}
            progressLabel={handProgressLabel}
            stateTone={summaryStateActive ? "emerald" : handScoringActive ? "amber" : "amber"}
            details={[
              `Resolution lane: ${handLaneState}`,
              `Room ${snapshot.code}`,
              `Target ${snapshot.targetScore}`,
              handSummaryReason ? `Reason ${handSummaryReason}` : "Reason pending",
              summaryStateActive
                ? "Awaiting settled hand recap"
                : handScoringActive
                  ? "Final hand state available"
                  : "Pending end-of-hand data",
            ]}
          />

          <SocialPanels />

          {error ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </aside>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/12 bg-slate-950/95 px-4 py-3 shadow-[0_-20px_60px_rgba(2,6,23,0.45)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Room status</p>
              <p className="mt-1 text-sm text-slate-100">
                {summaryStateActive
                  ? "Summary ready"
                  : isMyTurn
                    ? "Your response is pending"
                    : connectionLabel}
              </p>
              <p className="mt-1 text-xs text-slate-400">{lifecycleHeadline}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                {roomBadge}
              </span>
              {summaryStateActive ? (
                <button
                  type="button"
                  disabled
                  className="rounded-2xl border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold text-slate-100 opacity-80"
                >
                  Summary only
                </button>
              ) : currentSeat ? (
                <button
                  type="button"
                  disabled
                  className="rounded-2xl border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold text-slate-100 opacity-80"
                >
                  Live only
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Lobby</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">{snapshot.code}</h1>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200/78">
            {connectionLabel}
          </div>
        </div>

        <div className="mt-6">
          <LifecycleRail
            title="Lifecycle"
            subtitle="Reconnect, readiness, team balance, and match start stay visible in a compact strip that works on mobile and desktop."
            statusLabel={connectionLabel === "Live" ? "Lobby live" : connectionLabel}
            items={lifecycleItems}
            compact
          />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {snapshot.seats.map((seat) => (
            <article key={seat.id} className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 text-slate-100">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Seat {seat.seatIndex + 1}</p>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  Team {seat.teamSide ?? "-"}
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold">{seat.displayName ?? "Open seat"}</p>
              <p className="mt-2 text-sm text-slate-400">
                {seat.isHost ? "Host" : seat.id === currentSeat?.id ? "You" : "Player"} - {seat.status}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {seat.displayName ? (seat.isReady ? "Ready" : "Waiting") : "Available"}
              </p>

              {isHost ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["A", "B"] as TeamSide[]).map((teamSide) => (
                    <button
                      key={teamSide}
                      type="button"
                      disabled={actionPending || !seat.displayName}
                      onClick={() => handleSetTeam(seat.id, teamSide)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                        seat.teamSide === teamSide
                          ? "bg-cyan-300 text-slate-950"
                          : "border border-white/10 bg-slate-950 text-slate-200"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      Team {teamSide}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <aside className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200/70">Room config</p>
        <ul className="mt-6 space-y-4 text-sm text-slate-200/80">
          <li>Players: {snapshot.maxPlayers}</li>
          <li>Target score: {snapshot.targetScore}</li>
          <li>BONGS: {snapshot.allowBongs ? "Enabled" : "Disabled"}</li>
          <li>3v3: {snapshot.allow3v3 ? "Enabled" : "Disabled"}</li>
          <li>Phase: {phaseLabel}</li>
        </ul>

        <div className="mt-8 space-y-3 rounded-3xl border border-white/10 bg-slate-900/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Match gate</p>
          <p className="text-sm text-slate-200/80">
            Filled seats: {filledSeats.length}/{snapshot.maxPlayers}
          </p>
          <p className="text-sm text-slate-200/80">Everybody ready: {everybodyReady ? "Yes" : "No"}</p>
          <p className="text-sm text-slate-200/80">Teams balanced: {teamsBalanced ? "Yes" : "No"}</p>
        </div>

        <div className="mt-6">
          <EventFeed title="Lobby events" events={activeEvents} emptyLabel="No room events yet." />
        </div>

        {currentSeat ? (
          <button
            type="button"
            disabled={actionPending || lifecycleState !== "lobby"}
            onClick={handleToggleReady}
            className={`mt-6 w-full rounded-2xl px-4 py-3 font-semibold transition ${
              currentSeat.isReady
                ? "bg-amber-200 text-slate-950 hover:bg-amber-100"
                : "bg-emerald-300 text-slate-950 hover:bg-emerald-200"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {currentSeat.isReady ? "Unready" : "Mark ready"}
          </button>
        ) : null}

        {isHost ? (
          <button
            type="button"
            disabled={actionPending || lifecycleState !== "lobby"}
            onClick={handleStart}
            className="mt-3 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start match
          </button>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/12 bg-slate-950/95 px-4 py-3 shadow-[0_-20px_60px_rgba(2,6,23,0.45)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Lobby status</p>
              <p className="mt-1 text-sm text-slate-100">
                {connectionLabel === "Live"
                  ? everybodyReady
                    ? "Lobby ready to start"
                    : "Lobby waiting on ready seats"
                  : connectionLabel}
              </p>
              <p className="mt-1 text-xs text-slate-400">{lifecycleHeadline}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                {teamsBalanced ? "Teams ok" : "Teams open"}
              </span>
              {isHost ? (
                <button
                  type="button"
                  disabled={actionPending || lifecycleState !== "lobby"}
                  onClick={handleStart}
                  className="rounded-2xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Start
                </button>
              ) : currentSeat ? (
                <button
                  type="button"
                  disabled={actionPending || lifecycleState !== "lobby"}
                  onClick={handleToggleReady}
                  className="rounded-2xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {currentSeat.isReady ? "Unready" : "Ready"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
