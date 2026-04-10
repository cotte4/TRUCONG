"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function usePersistentInput(key: string, initial = "") {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setValue(saved);
  }, [key]);

  const set = (next: string) => {
    setValue(next);
    if (next) sessionStorage.setItem(key, next);
    else sessionStorage.removeItem(key);
  };

  return [value, set] as const;
}
import type { CreateRoomRequest, JoinRoomRequest, RoomEntryResponse } from "@dimadong/contracts";
import { apiBaseUrl } from "@/lib/config";
import { AVATAR_OPTIONS, DEFAULT_AVATAR_ID, isAvatarId } from "@/lib/avatar-catalog";

async function postJson<TBody, TResult>(url: string, body: TBody, timeoutMs = 15000): Promise<TResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const json = JSON.parse(text) as { message?: string };
        if (typeof json?.message === 'string') message = json.message;
      } catch { /* not JSON, use raw text */ }
      throw new Error(message || "La solicitud falló.");
    }

    return response.json() as Promise<TResult>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("El servidor tardó demasiado. Puede estar iniciando — intentá de nuevo en unos segundos.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function HomeClient() {
  const router = useRouter();
  const [createName, setCreateName] = usePersistentInput("home:createName");
  const [joinName, setJoinName] = usePersistentInput("home:joinName");
  const [roomCode, setRoomCode] = usePersistentInput("home:roomCode");
  const [createAvatarId, setCreateAvatarIdRaw] = usePersistentInput("home:createAvatarId", DEFAULT_AVATAR_ID);
  const [joinAvatarId, setJoinAvatarIdRaw] = usePersistentInput("home:joinAvatarId", DEFAULT_AVATAR_ID);
  const [maxPlayers, setMaxPlayers] = useState<2 | 4>(4);
  const [targetScore, setTargetScore] = useState<15 | 30>(30);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const isBusy = isCreating || isJoining;
  const selectedCreateAvatarId = isAvatarId(createAvatarId) ? createAvatarId : DEFAULT_AVATAR_ID;
  const selectedJoinAvatarId = isAvatarId(joinAvatarId) ? joinAvatarId : DEFAULT_AVATAR_ID;

  const enterRoom = (result: RoomEntryResponse) => {
    window.localStorage.setItem(`dimadong:${result.snapshot.code}:session`, result.session.roomSessionToken);
    window.localStorage.setItem(`dimadong:${result.snapshot.code}:seat`, result.session.seatId);
    sessionStorage.removeItem("home:createName");
    sessionStorage.removeItem("home:joinName");
    sessionStorage.removeItem("home:roomCode");
    router.push(`/rooms/${result.snapshot.code}`);
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmedName = createName.trim();

    if (isBusy) {
      return;
    }

    if (!trimmedName) {
      setError("Escribí tu nombre para crear la sala.");
      return;
    }

    void (async () => {
      setIsCreating(true);
      try {
        const payload: CreateRoomRequest = {
          displayName: trimmedName,
          avatarId: selectedCreateAvatarId,
          maxPlayers,
          targetScore,
          allowBongs: true,
        };
        const result = await postJson<CreateRoomRequest, RoomEntryResponse>(`${apiBaseUrl}/rooms`, payload);
        enterRoom(result);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No se pudo crear la sala.");
      } finally {
        setIsCreating(false);
      }
    })();
  };

  const handleJoin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmedName = joinName.trim();
    const normalizedCode = roomCode.trim().toUpperCase();

    if (isBusy) {
      return;
    }

    if (!normalizedCode) {
      setError("Ingresá el código de sala.");
      return;
    }

    if (!trimmedName) {
      setError("Escribí tu nombre para unirte.");
      return;
    }

    void (async () => {
      setIsJoining(true);
      try {
        const payload: JoinRoomRequest = {
          displayName: trimmedName,
          avatarId: selectedJoinAvatarId,
        };
        const result = await postJson<JoinRoomRequest, RoomEntryResponse>(
          `${apiBaseUrl}/rooms/${normalizedCode}/join`,
          payload,
        );
        enterRoom(result);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No se pudo entrar a la sala.");
      } finally {
        setIsJoining(false);
      }
    })();
  };

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleCreate}
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/72 p-6 backdrop-blur"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Crear sala</p>
        <label className="mt-6 block text-sm text-slate-200/78">
          Tu nombre
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
            <p className="text-sm text-slate-200/78">Modo</p>
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
                  {value === 2 ? "1 vs 1" : "2 vs 2"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-200/78">Puntaje objetivo</p>
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
                  {value} puntos
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm text-slate-200/78">Avatar</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {AVATAR_OPTIONS.map((avatar) => {
              const active = selectedCreateAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setCreateAvatarIdRaw(avatar.id)}
                  className={`overflow-hidden rounded-2xl border p-1 transition ${
                    active
                      ? "border-cyan-300/60 ring-2 ring-cyan-300/25"
                      : "border-white/10 bg-slate-900/70 hover:bg-slate-900"
                  }`}
                  aria-label={`Elegir avatar ${avatar.label}`}
                >
                  <div className="relative h-16 w-full overflow-hidden rounded-xl">
                    <Image
                      src={avatar.imagePath}
                      alt={avatar.label}
                      fill
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          disabled={isBusy}
          className="mt-6 w-full rounded-full bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isCreating ? "Creando..." : "Crear sala"}
        </button>
      </form>

      <form
        onSubmit={handleJoin}
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/72 p-6 backdrop-blur"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Unirse a sala</p>
        <label className="mt-6 block text-sm text-slate-200/78">
          Código de sala
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 uppercase text-white outline-none ring-0 placeholder:text-slate-400"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="ABC123"
            maxLength={6}
          />
        </label>
        <label className="mt-4 block text-sm text-slate-200/78">
          Tu nombre
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-400"
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            placeholder="Invitado"
            maxLength={24}
          />
        </label>
        <div className="mt-4">
          <p className="text-sm text-slate-200/78">Avatar</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {AVATAR_OPTIONS.map((avatar) => {
              const active = selectedJoinAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setJoinAvatarIdRaw(avatar.id)}
                  className={`overflow-hidden rounded-2xl border p-1 transition ${
                    active
                      ? "border-cyan-300/60 ring-2 ring-cyan-300/25"
                      : "border-white/10 bg-slate-900/70 hover:bg-slate-900"
                  }`}
                  aria-label={`Elegir avatar ${avatar.label}`}
                >
                  <div className="relative h-16 w-full overflow-hidden rounded-xl">
                    <Image
                      src={avatar.imagePath}
                      alt={avatar.label}
                      fill
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          disabled={isBusy}
          className="mt-6 w-full rounded-full bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isJoining ? "Entrando..." : "Entrar a la sala"}
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
