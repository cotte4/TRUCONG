"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CreateRoomRequest, JoinRoomRequest, RoomEntryResponse } from "@dimadong/contracts";
import { apiBaseUrl } from "@/lib/config";

async function postJson<TBody, TResult>(url: string, body: TBody): Promise<TResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }

  return response.json() as Promise<TResult>;
}

export function HomeClient() {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<2 | 4>(4);
  const [targetScore, setTargetScore] = useState<15 | 30>(30);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enterRoom = (result: RoomEntryResponse) => {
    window.localStorage.setItem(`dimadong:${result.snapshot.code}:session`, result.session.roomSessionToken);
    window.localStorage.setItem(`dimadong:${result.snapshot.code}:seat`, result.session.seatId);
    router.push(`/rooms/${result.snapshot.code}`);
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload: CreateRoomRequest = {
          displayName: createName,
          maxPlayers,
          targetScore,
          allowBongs: true,
        };
        const result = await postJson<CreateRoomRequest, RoomEntryResponse>(`${apiBaseUrl}/rooms`, payload);
        enterRoom(result);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not create room.");
      }
    });
  };

  const handleJoin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload: JoinRoomRequest = {
          displayName: joinName,
        };
        const result = await postJson<JoinRoomRequest, RoomEntryResponse>(
          `${apiBaseUrl}/rooms/${roomCode.trim().toUpperCase()}/join`,
          payload,
        );
        enterRoom(result);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not join room.");
      }
    });
  };

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleCreate}
        className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Create room</p>
        <label className="mt-6 block text-sm text-slate-200/78">
          Host name
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-400"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="Franco"
            maxLength={24}
          />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-200/78">Mode</p>
            <div className="mt-2 flex gap-2">
              {[2, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMaxPlayers(value as 2 | 4)}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    maxPlayers === value
                      ? "bg-cyan-300 text-slate-950"
                      : "border border-white/10 bg-slate-900/90 text-slate-200"
                  }`}
                >
                  {value === 2 ? "1v1" : "2v2"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-200/78">Target score</p>
            <div className="mt-2 flex gap-2">
              {[15, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTargetScore(value as 15 | 30)}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    targetScore === value
                      ? "bg-cyan-300 text-slate-950"
                      : "border border-white/10 bg-slate-900/90 text-slate-200"
                  }`}
                >
                  {value} points
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="mt-6 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Creating..." : "Create private lobby"}
        </button>
      </form>

      <form
        onSubmit={handleJoin}
        className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200/70">Join room</p>
        <label className="mt-6 block text-sm text-slate-200/78">
          Room code
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 uppercase text-white outline-none ring-0 placeholder:text-slate-400"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="ABC123"
            maxLength={6}
          />
        </label>
        <label className="mt-4 block text-sm text-slate-200/78">
          Player name
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-400"
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            placeholder="Invitado"
            maxLength={24}
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="mt-6 w-full rounded-2xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Joining..." : "Join lobby"}
        </button>
      </form>

      {error ? (
        <div className="lg:col-span-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </section>
  );
}
