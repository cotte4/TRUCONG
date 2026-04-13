"use client";

import type {
  CreateRoomRequest,
  JoinRoomRequest,
  RoomEntryResponse,
} from "@dimadong/contracts";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AVATAR_OPTIONS, DEFAULT_AVATAR_ID, isAvatarId } from "@/lib/avatar-catalog";
import { apiBaseUrl } from "@/lib/config";

const INITIAL_REQUEST_TIMEOUT_MS = 15000;
const RETRY_REQUEST_TIMEOUT_MS = 30000;

class RequestTimeoutError extends Error {
  constructor() {
    super("Request timed out.");
    this.name = "RequestTimeoutError";
  }
}

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

async function fetchJsonWithTimeout<TResult>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<TResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;

      try {
        const json = JSON.parse(text) as { message?: string };
        if (typeof json.message === "string") {
          message = json.message;
        }
      } catch {
        // Not JSON; keep the raw response text.
      }

      throw new Error(message || "La solicitud fallo.");
    }

    return response.json() as Promise<TResult>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new RequestTimeoutError();
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function warmUpServer(baseUrl: string) {
  try {
    await fetch(baseUrl, { method: "GET", cache: "no-store" });
  } catch {
    // Best effort only. The retry below is what matters.
  }
}

async function postJson<TBody, TResult>(url: string, body: TBody): Promise<TResult> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };

  try {
    return await fetchJsonWithTimeout<TResult>(
      url,
      requestInit,
      INITIAL_REQUEST_TIMEOUT_MS,
    );
  } catch (err) {
    if (!(err instanceof RequestTimeoutError)) {
      throw err;
    }

    await warmUpServer(apiBaseUrl);

    try {
      return await fetchJsonWithTimeout<TResult>(
        url,
        requestInit,
        RETRY_REQUEST_TIMEOUT_MS,
      );
    } catch (retryError) {
      if (retryError instanceof RequestTimeoutError) {
        throw new Error(
          "El servidor tardo demasiado. Puede estar iniciando; intenta de nuevo en unos segundos.",
        );
      }

      throw retryError;
    }
  }
}

function AvatarPicker({
  selectedAvatarId,
  onSelect,
}: {
  selectedAvatarId: string;
  onSelect: (avatarId: string) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-2">
      {AVATAR_OPTIONS.map((avatar) => {
        const active = selectedAvatarId === avatar.id;

        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelect(avatar.id)}
            className={`overflow-hidden rounded-[1.2rem] border p-1 transition ${
              active
                ? "border-fuchsia-300/65 bg-fuchsia-400/8 ring-2 ring-fuchsia-300/25"
                : "border-white/10 bg-slate-950/80 hover:border-cyan-300/25 hover:bg-slate-950"
            }`}
            aria-label={`Elegir avatar ${avatar.label}`}
            aria-pressed={active}
          >
            <div className="relative h-16 w-full overflow-hidden rounded-xl">
              <Image
                src={avatar.imagePath}
                alt={avatar.label}
                fill
                sizes="(max-width: 640px) 20vw, 96px"
                className="object-cover"
                loading="lazy"
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function HomeClient({ bongUnlocked = false }: { bongUnlocked?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createName, setCreateName] = usePersistentInput("home:createName");
  const [joinName, setJoinName] = usePersistentInput("home:joinName");
  const [roomCode, setRoomCode] = usePersistentInput("home:roomCode");
  const [createAvatarId, setCreateAvatarIdRaw] = usePersistentInput(
    "home:createAvatarId",
    DEFAULT_AVATAR_ID,
  );
  const [joinAvatarId, setJoinAvatarIdRaw] = usePersistentInput(
    "home:joinAvatarId",
    DEFAULT_AVATAR_ID,
  );
  const [maxPlayers, setMaxPlayers] = useState<2 | 4 | 6>(2);
  const [targetScore, setTargetScore] = useState<11 | 15 | 30>(15);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const isBusy = isCreating || isJoining;
  const selectedCreateAvatarId = isAvatarId(createAvatarId)
    ? createAvatarId
    : DEFAULT_AVATAR_ID;
  const selectedJoinAvatarId = isAvatarId(joinAvatarId)
    ? joinAvatarId
    : DEFAULT_AVATAR_ID;

  useEffect(() => {
    const sharedRoomCode = searchParams.get("room")?.trim().toUpperCase() ?? "";

    if (!sharedRoomCode || sharedRoomCode === roomCode) {
      return;
    }

    setRoomCode(sharedRoomCode);
  }, [roomCode, searchParams, setRoomCode]);

  const enterRoom = (result: RoomEntryResponse) => {
    window.localStorage.setItem(
      `dimadong:${result.snapshot.code}:session`,
      result.session.roomSessionToken,
    );
    window.localStorage.setItem(
      `dimadong:${result.snapshot.code}:seat`,
      result.session.seatId,
    );
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
      setError("Escribi tu nombre para crear la sala.");
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
          allowBongs: bongUnlocked,
        };
        const result = await postJson<CreateRoomRequest, RoomEntryResponse>(
          `${apiBaseUrl}/rooms`,
          payload,
        );
        enterRoom(result);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "No se pudo crear la sala.",
        );
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
      setError("Ingresa el codigo de sala.");
      return;
    }

    if (!trimmedName) {
      setError("Escribi tu nombre para unirte.");
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
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "No se pudo entrar a la sala.",
        );
      } finally {
        setIsJoining(false);
      }
    })();
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <form
        onSubmit={handleCreate}
        className="trap-panel rounded-[1.75rem] p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
          Crear sala
        </p>
        <label className="mt-6 block text-sm text-slate-200/78">
          Tu nombre
          <input
            className="trap-input mt-2 w-full rounded-[1rem] px-4 py-3 text-white outline-none placeholder:text-slate-500"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="Franco"
            maxLength={24}
          />
        </label>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-200/78">Avatar</p>
            <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-200/55">
              Paso 1
            </p>
          </div>
          <AvatarPicker
            selectedAvatarId={selectedCreateAvatarId}
            onSelect={setCreateAvatarIdRaw}
          />
        </div>
        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Configuracion
            </p>
            <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-200/55">
              Paso 2
            </p>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-200/78">Modo</p>
                {maxPlayers === 6 ? (
                  <span className="rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-lime-100">
                    Experimental
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4">
                {([2, 4, 6] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMaxPlayers(value)}
                    className={`trap-option rounded-[1rem] px-5 py-4 text-center text-[0.95rem] font-semibold tracking-[0.02em] transition ${
                      maxPlayers === value
                        ? "trap-option-active"
                        : "text-slate-200"
                    }`}
                    aria-pressed={maxPlayers === value}
                  >
                    {value === 2 ? "1 vs 1" : value === 4 ? "2 vs 2" : "3 vs 3"}
                  </button>
                ))}
              </div>
              {maxPlayers === 6 ? (
                <p className="mt-2 text-xs text-lime-200/75">
                  Incluye PICA PICA cada dos rondas.
                </p>
              ) : null}
            </div>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm text-slate-200/78">Puntaje objetivo</p>
                <p className="text-xs text-fuchsia-200/75">
                  11 es el numero verdadero de DIMADONG.
                </p>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {[11, 15, 30].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTargetScore(value as 11 | 15 | 30)}
                    className={`trap-option rounded-[1rem] px-5 py-4 text-[0.95rem] font-semibold tracking-[0.02em] transition ${
                      targetScore === value
                        ? "trap-option-active"
                        : "text-slate-200"
                    }`}
                    aria-pressed={targetScore === value}
                  >
                    {value === 11 ? "11 DIMADONG" : `${value} puntos`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {bongUnlocked && (
          <div className="mt-4 rounded-2xl border border-lime-300/25 bg-lime-300/10 px-4 py-3 text-sm text-lime-50">
            Esta sala va a crearse con el protocolo BONG activo.
          </div>
        )}
        <button
          type="submit"
          disabled={isBusy}
          className="trap-cta mt-6 w-full px-4 py-3 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isCreating
            ? "Creando..."
            : bongUnlocked
              ? "Crear sala infectada"
              : "Crear sala"}
        </button>
      </form>

      <form
        onSubmit={handleJoin}
        className="trap-panel rounded-[1.75rem] p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
          Unirse a sala
        </p>
        <label className="mt-6 block text-sm text-slate-200/78">
          Codigo de sala
          <input
            className="trap-input mt-2 w-full rounded-[1rem] px-4 py-3 uppercase text-white outline-none placeholder:text-slate-500"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="ABC123"
            maxLength={6}
          />
        </label>
        <label className="mt-4 block text-sm text-slate-200/78">
          Tu nombre
          <input
            className="trap-input mt-2 w-full rounded-[1rem] px-4 py-3 text-white outline-none placeholder:text-slate-500"
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            placeholder="Invitado"
            maxLength={24}
          />
        </label>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-200/78">Avatar</p>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/55">
              Identidad
            </p>
          </div>
          <AvatarPicker
            selectedAvatarId={selectedJoinAvatarId}
            onSelect={setJoinAvatarIdRaw}
          />
        </div>
        <button
          type="submit"
          disabled={isBusy}
          className="trap-cta mt-6 w-full px-4 py-3 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-70"
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
