"use client";

import { HomeClient } from "@/components/home-client";
import Link from "next/link";
import { Suspense, useState } from "react";

const BONG_UNLOCK_STORAGE_KEY = "dimadong:landing:bong-unlocked";

function AlienSignal({
  bongUnlocked,
  onUnlock,
  isDormant,
}: {
  bongUnlocked: boolean;
  onUnlock: () => void;
  isDormant: boolean;
}) {
  const [tapCount, setTapCount] = useState(0);
  const [isSignalGlitching, setIsSignalGlitching] = useState(false);
  const signalCharged = bongUnlocked || tapCount > 0 || isSignalGlitching;

  const handleAlienTap = () => {
    if (isDormant) {
      return;
    }

    if (bongUnlocked) {
      setIsSignalGlitching(true);
      window.setTimeout(() => setIsSignalGlitching(false), 760);
      return;
    }

    setTapCount((current) => {
      const next = current + 1;

      if (next < 3) {
        return next;
      }

      onUnlock();
      setIsSignalGlitching(true);
      window.setTimeout(() => setIsSignalGlitching(false), 760);
      return 0;
    });
  };

  return (
    <div className="relative flex h-[18rem] w-full max-w-[22rem] items-center justify-center sm:h-[22rem] sm:max-w-[26rem] lg:h-[20rem] lg:max-w-[22rem] xl:h-[22rem] xl:max-w-[24rem]">
      <div className="absolute inset-0 rounded-full bg-cyan-400/6 blur-3xl" />
      <div className="absolute inset-[9%] rounded-full border border-cyan-400/10" />
      <div className="absolute inset-[20%] rounded-full border border-cyan-400/8" />

      <button
        type="button"
        onClick={handleAlienTap}
        className={`group relative rounded-full p-3 transition focus:outline-none focus:ring-2 focus:ring-cyan-300/45 ${
          signalCharged ? "shadow-[0_0_40px_rgba(34,211,238,0.12)]" : ""
        }`}
        aria-label={bongUnlocked ? "Protocolo BONG activo" : "Ovni alien"}
      >
        <span
          className={`pointer-events-none absolute inset-5 rounded-full border ${
            signalCharged ? "border-cyan-300/25" : "border-white/10"
          } ${isSignalGlitching ? "landing-glitch-ring" : ""}`}
        />
        <svg
          viewBox="0 0 200 200"
          className={`relative h-60 w-60 transition duration-500 group-hover:scale-[1.03] sm:h-72 sm:w-72 ${
            isSignalGlitching ? "landing-glitch-svg" : "landing-ufo-float"
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
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, index) => {
            const rad = (deg * Math.PI) / 180;
            const x = 100 + 50 * Math.cos(rad);
            const y = 108 + 13 * Math.sin(rad);
            const colors = ["#67e8f9", "#f87171", "#4ade80", "#fbbf24"];

            return (
              <circle
                key={deg}
                cx={x}
                cy={y}
                r="2.5"
                fill={colors[index % colors.length]}
                opacity="0.9"
              />
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
        className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] transition ${
          bongUnlocked
            ? "border-amber-300/40 bg-amber-300/12 text-amber-100 opacity-100"
            : "border-white/0 bg-transparent text-transparent opacity-0"
        }`}
      >
        Protocolo BONG
      </div>

      {isSignalGlitching ? <div className="landing-glitch-scanline absolute inset-0 rounded-full" /> : null}
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
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);

  const handleUnlockBong = () => {
    setBongUnlocked(true);
    window.sessionStorage.setItem(BONG_UNLOCK_STORAGE_KEY, "true");
  };

  return (
    <main className="min-h-[100dvh] overflow-hidden p-3 sm:p-5 lg:p-4 xl:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-7xl sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-2rem)] xl:min-h-[calc(100dvh-3rem)]">
        <div className="landing-stage relative isolate min-h-full w-full overflow-hidden rounded-[1.75rem] border border-white/10 shadow-[0_30px_120px_rgba(2,6,23,0.42)] sm:rounded-[2rem]">
          <section
            className={`landing-view ${isLobbyOpen ? "landing-intro-out" : "landing-intro-in"}`}
            aria-hidden={isLobbyOpen}
            inert={isLobbyOpen}
          >
            <div className="grid min-h-full gap-6 px-6 py-7 sm:px-10 sm:py-9 lg:grid-cols-[minmax(0,1.02fr)_minmax(260px,0.78fr)] lg:items-center lg:gap-6 lg:px-10 lg:py-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.82fr)] xl:gap-10 xl:px-12 xl:py-8">
              <div className="flex min-w-0 flex-col justify-center gap-4 pb-4 text-left sm:gap-5 sm:pb-6 lg:gap-3 lg:pb-6">
                <h1
                  className="max-w-[10ch] font-brand-display leading-[1.03] text-white [letter-spacing:0.04em] sm:max-w-[11ch] lg:max-w-[16ch] xl:[letter-spacing:0.08em]"
                  style={{ fontSize: "clamp(2.3rem, 4.15vw + 0.8rem, 5.4rem)" }}
                >
                  <span className="lg:hidden">
                    TRUCO CON
                    <br />
                    <span className="text-cyan-300">ALIENS,</span>
                    <span className="hidden sm:inline"> DIMADONGS</span>
                    <span className="sm:hidden">
                      <br />
                      DIMADONGS
                    </span>
                    <span className="hidden sm:inline">
                      <br />
                      Y <span className="text-rose-400">CAOS</span> CONTROLADO.
                    </span>
                    <span className="sm:hidden">
                      <br />
                      Y <span className="text-rose-400">CAOS</span>
                      <br />
                      CONTROLADO.
                    </span>
                  </span>
                  <span className="hidden max-w-[15ch] lg:block">
                    TRUCO CON
                    <br />
                    <span className="text-cyan-300">ALIENS,</span>
                    <br />
                    DIMADONGS Y
                    <br />
                    <span className="text-rose-400">CAOS</span> CONTROLADO.
                  </span>
                </h1>
                <p className="max-w-[16rem] pb-1 text-[clamp(0.95rem,1.3vw+0.7rem,1.12rem)] leading-7 text-slate-300 sm:max-w-[24rem] sm:leading-8 lg:max-w-[30rem] lg:pb-2 lg:leading-7 xl:max-w-[32rem]">
                  Armas la sala, pasas el codigo y arranca la mano: reglas conocidas, mutaciones alien y alguna senal
                  rara que conviene no tocar demasiado.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => setIsLobbyOpen(true)}
                    className="landing-enter-button rounded-full px-8 py-4 text-sm font-black uppercase tracking-[0.28em] text-slate-950 sm:px-10 sm:py-4.5 sm:text-base lg:px-11 lg:py-4 lg:text-[0.95rem]"
                  >
                    Entrar a la nave
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <AlienSignal
                  bongUnlocked={bongUnlocked}
                  onUnlock={handleUnlockBong}
                  isDormant={isLobbyOpen}
                />
              </div>
            </div>
          </section>

          <section
            className={`landing-view landing-lobby ${isLobbyOpen ? "landing-lobby-open" : "landing-lobby-closed"}`}
            aria-hidden={!isLobbyOpen}
            inert={!isLobbyOpen}
          >
            <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/10 bg-slate-950/72 px-5 py-3 backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">
                    UFO
                  </span>
                  <p className="font-brand-display text-xs text-slate-300">Dimadong</p>
                </div>
                <Link
                  href="/manual"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Como se juega
                </Link>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-2">
                  <div className="space-y-2 px-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">Lobby</p>
                    <h2 className="font-brand-display text-2xl text-white sm:text-3xl">
                      Crear sala, invitar y despegar.
                    </h2>
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
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
