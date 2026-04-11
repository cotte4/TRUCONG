"use client";

import { HomeClient } from "@/components/home-client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";

const BONG_UNLOCK_STORAGE_KEY = "dimadong:landing:bong-unlocked";

function AlienSignal({
  bongUnlocked,
  onUnlock,
}: {
  bongUnlocked: boolean;
  onUnlock: () => void;
}) {
  const [tapCount, setTapCount] = useState(0);
  const [localSignalVisible, setLocalSignalVisible] = useState(false);
  const [isSignalGlitching, setIsSignalGlitching] = useState(false);
  const [isUnlockGlitching, setIsUnlockGlitching] = useState(false);
  const signalVisible = bongUnlocked || localSignalVisible;

  const handleAlienTap = () => {
    if (bongUnlocked) {
      return;
    }

    setTapCount((current) => {
      const next = current + 1;
      if (next >= 3) {
        setLocalSignalVisible(true);
        setIsSignalGlitching(true);
        window.setTimeout(() => setIsSignalGlitching(false), 760);
      }
      return next;
    });
  };

  const handleUnlockClick = () => {
    if (bongUnlocked) {
      return;
    }

    setIsUnlockGlitching(true);
    window.setTimeout(() => {
      onUnlock();
      setIsUnlockGlitching(false);
    }, 420);
  };

  return (
    <div className="relative flex h-72 w-full max-w-[19rem] flex-shrink-0 items-center justify-center self-center lg:h-80 lg:max-w-none lg:self-auto">
      <div className="absolute inset-0 rounded-full bg-cyan-400/5 blur-3xl" />
      <div className="absolute inset-8 rounded-full border border-cyan-400/10" />
      <div className="absolute inset-16 rounded-full border border-cyan-400/8" />
      <button
        type="button"
        onClick={handleAlienTap}
        className={`group relative rounded-full p-2 transition focus:outline-none focus:ring-2 focus:ring-cyan-300/40 ${
          signalVisible ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""
        }`}
        aria-label={signalVisible ? "Senal alien detectada" : "Tocar alien"}
      >
        <span
          className={`pointer-events-none absolute inset-4 rounded-full border border-cyan-300/20 ${
            isSignalGlitching || isUnlockGlitching ? "landing-glitch-ring" : ""
          }`}
        />
        <svg
          viewBox="0 0 200 200"
          className={`relative h-56 w-56 ufo-pulse transition duration-300 group-hover:scale-[1.03] lg:h-64 lg:w-64 ${
            isSignalGlitching || isUnlockGlitching ? "landing-glitch-svg" : ""
          }`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <polygon
            points="82,120 118,120 130,180 70,180"
            fill="url(#beamGrad)"
            className="alien-beam"
          />
          <ellipse cx="100" cy="108" rx="52" ry="14" fill="#1e3a5f" stroke="#67e8f9" strokeWidth="1.5" />
          <ellipse cx="100" cy="100" rx="28" ry="20" fill="#0f2440" stroke="#67e8f9" strokeWidth="1.5" />
          <ellipse cx="93" cy="95" rx="8" ry="5" fill="#67e8f9" opacity="0.15" />
          <ellipse cx="100" cy="100" rx="10" ry="12" fill="#4ade80" className="alien-bob" />
          <circle cx="97" cy="97" r="2" fill="#052e16" />
          <circle cx="103" cy="97" r="2" fill="#052e16" />
          <path d="M97 103 Q100 106 103 103" stroke="#052e16" strokeWidth="1" fill="none" />
          <line x1="96" y1="88" x2="90" y2="80" stroke="#4ade80" strokeWidth="1.5" />
          <circle cx="90" cy="79" r="2" fill="#4ade80" />
          <line x1="104" y1="88" x2="110" y2="80" stroke="#4ade80" strokeWidth="1.5" />
          <circle cx="110" cy="79" r="2" fill="#4ade80" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x = 100 + 50 * Math.cos(rad);
            const y = 108 + 13 * Math.sin(rad);
            const colors = ["#67e8f9", "#f87171", "#4ade80", "#fbbf24"];
            return (
              <circle key={deg} cx={x} cy={y} r="2.5" fill={colors[i % colors.length]} opacity="0.9" />
            );
          })}
          <defs>
            <linearGradient id="beamGrad" x1="100" y1="120" x2="100" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </button>

      <div
        className={`absolute bottom-3 right-0 rounded-2xl border px-3 py-2 text-xs shadow-xl backdrop-blur transition ${
          signalVisible
            ? "border-amber-300/40 bg-amber-300/12 text-amber-100"
            : "border-white/10 bg-slate-900/90 text-slate-300"
        } ${isSignalGlitching || isUnlockGlitching ? "landing-glitch-panel" : ""}`}
      >
        {signalVisible
          ? isUnlockGlitching
            ? "S3NAL//INTERCEPTADA"
            : "SENAL INTERCEPTADA"
          : tapCount > 0
            ? `${Math.max(0, 3 - tapCount)} toques para abrir la senal`
            : "Toca el alien"}
      </div>

      {signalVisible ? (
        <button
          type="button"
          onClick={handleUnlockClick}
          className={`absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] transition ${
            bongUnlocked
              ? "border-emerald-300/40 bg-emerald-300/12 text-emerald-100"
              : "border-amber-300/45 bg-amber-300/14 text-amber-100 hover:bg-amber-300/22"
          } ${isUnlockGlitching ? "landing-glitch-button" : ""}`}
        >
          {bongUnlocked ? "Protocolo BONG activo" : isUnlockGlitching ? "Activando..." : "Activar protocolo BONG"}
        </button>
      ) : null}
      {isSignalGlitching || isUnlockGlitching ? <div className="landing-glitch-scanline absolute inset-0 rounded-full" /> : null}
    </div>
  );
}

export default function Home() {
  const [bongUnlocked, setBongUnlocked] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.sessionStorage.getItem(BONG_UNLOCK_STORAGE_KEY) === "true";
  });

  const handleUnlockBong = () => {
    setBongUnlocked(true);
    window.sessionStorage.setItem(BONG_UNLOCK_STORAGE_KEY, "true");
  };

  const heroChips = useMemo(
    () => [
      "?? Aliens",
      "?? DIMADONG",
      bongUnlocked ? "?? Protocolo BONG" : "?? Senal clasificada",
      "?? Sala privada",
      "? Tiempo real",
    ],
    [bongUnlocked],
  );

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/72 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="inline-block text-xl ufo-pulse">🛸</span>
            <div>
              <p className="font-brand-display text-xs text-slate-300">Dimadong</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/manual"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Como se juega
            </Link>
            <Link
              href="#crear-sala"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Crear sala
            </Link>
          </div>
        </nav>

        <section className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex-1 space-y-6">
            <h1 className="font-brand-display text-5xl text-white sm:text-6xl lg:text-7xl">
              Truco con <span className="text-cyan-300">aliens,</span>
              <br />
              DIMADONGS y
              <br />
              <span className="text-rose-400">caos</span> controlado.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Armas la sala, pasas el codigo y arranca la mano: reglas conocidas, mutaciones alien y alguna senal rara
              que conviene no tocar demasiado.
            </p>
            <div className="flex flex-wrap gap-2">
              {heroChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
                >
                  {chip}
                </span>
              ))}
            </div>
            {bongUnlocked ? (
              <div className="max-w-xl rounded-[1.4rem] border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-50 shadow-[0_12px_40px_rgba(251,191,36,0.08)]">
                El protocolo BONG quedo activo para esta sesion. Las salas nuevas nacen infectadas con ese modo
                secreto.
              </div>
            ) : (
              <p className="max-w-xl text-sm uppercase tracking-[0.28em] text-cyan-200/55">
                Hay algo escondido en el alien.
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="#crear-sala"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Crear sala ahora
              </Link>
              <Link
                href="/manual"
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Ver las reglas
              </Link>
            </div>
          </div>

          <AlienSignal bongUnlocked={bongUnlocked} onUnlock={handleUnlockBong} />
        </section>

        <section id="crear-sala" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Entrada</p>
              <h2 className="mt-2 font-brand-display text-3xl text-white">Crear o unirse a una sala</h2>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/72 p-6 text-sm text-slate-300 backdrop-blur">
                Cargando acceso a la sala...
              </div>
            }
          >
            <HomeClient bongUnlocked={bongUnlocked} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
