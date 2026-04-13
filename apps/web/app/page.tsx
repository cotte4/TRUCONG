"use client";

import { HomeClient } from "@/components/home-client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

const LANDING_TRANSITION_MS = 340;

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

    const next = tapCount + 1;

    if (next < 3) {
      setTapCount(next);
    } else {
      setTapCount(0);
      onUnlock();
      setIsSignalGlitching(true);
      window.setTimeout(() => setIsSignalGlitching(false), 760);
    }
  };

  return (
    <div className="relative flex h-[18rem] w-full max-w-[22rem] items-center justify-center sm:h-[22rem] sm:max-w-[26rem] lg:h-[20rem] lg:max-w-[22rem] xl:h-[22rem] xl:max-w-[24rem]">
      <div className="landing-ufo-haze landing-ufo-haze-left" />
      <div className="landing-ufo-haze landing-ufo-haze-right" />
      <div className="landing-ufo-smog landing-ufo-smog-low" />
      <div className="landing-ufo-smog landing-ufo-smog-mid" />
      <div className="absolute inset-[8%] rounded-[44%] border border-fuchsia-400/14" />
      <div className="absolute inset-[20%] rounded-[46%] border border-cyan-300/10" />

      <button
        type="button"
        onClick={handleAlienTap}
        className={`group relative rounded-[2rem] p-3 transition focus:outline-none focus:ring-2 focus:ring-fuchsia-400/45 ${
          signalCharged ? "shadow-[0_0_50px_rgba(255,43,214,0.16)]" : ""
        }`}
        aria-label={bongUnlocked ? "Protocolo BONG activo" : "Ovni alien"}
      >
        <span
          className={`pointer-events-none absolute inset-5 rounded-[40%] border ${
            signalCharged ? "border-fuchsia-300/28" : "border-white/10"
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
          <path
            d="M75 115 L125 115 L146 176 L54 176 Z"
            fill="url(#beamCore)"
            className="alien-beam"
          />
          <path
            d="M44 108 C58 88 82 77 100 76 C118 77 142 88 156 108 L144 119 C131 114 117 111 100 111 C83 111 69 114 56 119 Z"
            fill="url(#ufoHull)"
            stroke="#b515ff"
            strokeWidth="2"
          />
          <path
            d="M68 86 C78 60 122 60 132 86 C121 91 112 93 100 93 C88 93 79 91 68 86 Z"
            fill="url(#ufoDome)"
            stroke="#8efb45"
            strokeWidth="1.7"
          />
          <path
            d="M64 118 H136 L125 142 H75 Z"
            fill="url(#ufoEngine)"
            stroke="#67f6ff"
            strokeWidth="1.4"
          />
          <path
            d="M82 98 H118"
            stroke="#f7fbff"
            strokeOpacity="0.22"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[74, 90, 110, 126].map((x, index) => (
            <rect
              key={x}
              x={x}
              y="104"
              width="10"
              height="8"
              rx="2"
              fill={index % 2 === 0 ? "#ff2bd6" : "#8efb45"}
              className="landing-ufo-light"
            />
          ))}
          <path
            d="M84 70 C89 65 95 63 100 63 C105 63 111 65 116 70"
            stroke="#67f6ff"
            strokeOpacity="0.72"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg, index) => {
            const rad = (deg * Math.PI) / 180;
            const x = Math.round((100 + 54 * Math.cos(rad)) * 1e4) / 1e4;
            const y = Math.round((109 + 14 * Math.sin(rad)) * 1e4) / 1e4;
            const colors = ["#67f6ff", "#ff2bd6", "#8efb45", "#a855f7"];

            return (
              <circle
                key={deg}
                cx={x}
                cy={y}
                r="2.3"
                fill={colors[index % colors.length]}
                opacity="0.9"
              />
            );
          })}
          <defs>
            <linearGradient id="beamCore" x1="100" y1="115" x2="100" y2="176" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8efb45" stopOpacity="0.52" />
              <stop offset="45%" stopColor="#67f6ff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#8efb45" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ufoHull" x1="46" y1="84" x2="152" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#05070d" />
              <stop offset="48%" stopColor="#1d2437" />
              <stop offset="100%" stopColor="#090b13" />
            </linearGradient>
            <linearGradient id="ufoDome" x1="100" y1="61" x2="100" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38105e" />
              <stop offset="58%" stopColor="#16061f" />
              <stop offset="100%" stopColor="#05070d" />
            </linearGradient>
            <linearGradient id="ufoEngine" x1="64" y1="118" x2="136" y2="142" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#080c14" />
              <stop offset="50%" stopColor="#121826" />
              <stop offset="100%" stopColor="#05070d" />
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
  const [bongUnlocked, setBongUnlocked] = useState(false);
  const [landingPhase, setLandingPhase] = useState<"intro" | "transition" | "lobby">("intro");

  const handleUnlockBong = () => {
    setBongUnlocked(true);
  };

  useEffect(() => {
    if (landingPhase !== "transition") {
      return;
    }

    const timer = window.setTimeout(() => {
      setLandingPhase("lobby");
    }, LANDING_TRANSITION_MS);

    return () => window.clearTimeout(timer);
  }, [landingPhase]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    if (landingPhase !== "intro") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [landingPhase]);

  const isLobbyOpen = landingPhase === "lobby";
  const isTransitioning = landingPhase === "transition";
  const isLobbyOverlayActive = landingPhase !== "intro";

  const handleOpenLobby = () => {
    if (landingPhase !== "intro") {
      return;
    }

    setLandingPhase("transition");
  };

  return (
    <>
      <main className="h-[100dvh] overflow-hidden p-3 sm:p-5 lg:p-4 xl:p-6">
        <div className="mx-auto h-full max-w-7xl">
          <div className="landing-stage relative isolate h-full w-full overflow-hidden rounded-[1.75rem] border border-white/10 shadow-[0_30px_120px_rgba(2,6,23,0.42)] sm:rounded-[2rem]">
          <section
            className={`landing-view landing-intro ${
              isTransitioning
                ? "landing-intro-out"
                : isLobbyOpen
                  ? "landing-intro-hidden"
                  : "landing-intro-in"
            }`}
            aria-hidden={isLobbyOpen}
            inert={landingPhase !== "intro"}
          >
            <div className="grid h-full gap-6 px-6 py-7 sm:px-10 sm:py-9 lg:grid-cols-[minmax(0,1.02fr)_minmax(260px,0.78fr)] lg:items-center lg:gap-6 lg:px-10 lg:py-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.82fr)] xl:gap-10 xl:px-12 xl:py-8">
              <div className="flex min-w-0 flex-col justify-center gap-4 pb-4 text-left sm:gap-5 sm:pb-6 lg:gap-3 lg:pb-6">
                <p className="landing-copy-kicker">
                  CLUB PRIVADO // CODIGO EN MANO // RUIDO EN LA SENAL
                </p>
                <h1
                  className="max-w-[10ch] font-brand-display leading-[1.03] text-white [letter-spacing:0.04em] sm:max-w-[11ch] lg:max-w-[16ch] xl:[letter-spacing:0.08em]"
                  style={{ fontSize: "clamp(2.3rem, 4.15vw + 0.8rem, 5.4rem)" }}
                >
                  <span className="lg:hidden">
                    TRUCO CON
                    <br />
                    <span className="landing-neon-cyan">ALIENS,</span>
                    <span className="hidden sm:inline"> </span>
                    <span className="landing-neon-slime hidden sm:inline whitespace-nowrap">
                      DIMADONGS&nbsp;Y
                    </span>
                    <span className="sm:hidden">
                      <br />
                      <span className="landing-neon-slime whitespace-nowrap">DIMADONGS&nbsp;Y</span>
                    </span>
                    <span className="hidden sm:inline">
                      <br />
                      <span className="landing-chaos-word">CAOS</span> CONTROLADO.
                    </span>
                    <span className="sm:hidden">
                      <br />
                      <span className="landing-chaos-word">CAOS</span> CONTROLADO.
                    </span>
                  </span>
                  <span className="hidden max-w-[15ch] lg:block">
                    TRUCO CON
                    <br />
                    <span className="landing-neon-cyan">ALIENS,</span>
                    <br />
                    <span className="landing-neon-slime whitespace-nowrap">DIMADONGS&nbsp;Y</span>
                    <br />
                    <span className="landing-chaos-word">CAOS</span> CONTROLADO.
                  </span>
                </h1>
                <p className="landing-copy-body max-w-[17rem] pb-1 text-[clamp(0.95rem,1.3vw+0.7rem,1.12rem)] leading-7 sm:max-w-[24rem] sm:leading-8 lg:max-w-[31rem] lg:pb-2 lg:leading-7 xl:max-w-[33rem]">
                  Armas la sala, pasas el codigo y arranca la mano. Truco conocido, humo toxico, neones violentos y una
                  vibra de sotano alien donde cada canto suena a problema.
                </p>
                <div className="flex flex-wrap gap-2 text-[0.68rem] font-black uppercase tracking-[0.28em] text-white/75">
                  <span className="landing-info-chip">Sin login</span>
                  <span className="landing-info-chip">Salas privadas</span>
                  {bongUnlocked && (
                    <span className="landing-info-chip landing-info-chip-bong">BONG ready</span>
                  )}
                </div>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={handleOpenLobby}
                    disabled={landingPhase !== "intro"}
                    className="landing-enter-button rounded-full px-8 py-4 text-sm font-black uppercase tracking-[0.28em] text-slate-950 sm:px-10 sm:py-4.5 sm:text-base lg:px-11 lg:py-4 lg:text-[0.95rem]"
                  >
                    Entrar a la nave
                  </button>
                  <Link
                    href="/anotador"
                    className="trap-ghost-button inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-100 transition"
                  >
                    Anotador
                  </Link>
                  <Link
                    href="/manual"
                    className="px-2 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400 transition hover:text-slate-200"
                  >
                    Manual
                  </Link>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <AlienSignal
                  bongUnlocked={bongUnlocked}
                  onUnlock={handleUnlockBong}
                  isDormant={landingPhase !== "intro"}
                />
              </div>
            </div>
          </section>
        </div>
        </div>
      </main>

      <section
        className={`lobby-overlay ${isLobbyOverlayActive ? "lobby-overlay-open" : "lobby-overlay-closed"}`}
        aria-hidden={!isLobbyOverlayActive}
      >
        <div
          className={`lobby-overlay-shell ${isLobbyOpen ? "lobby-overlay-shell-open" : "lobby-overlay-shell-closed"}`}
          inert={!isLobbyOpen}
        >
          <div className="flex flex-col gap-5">
            <div className="trap-topbar flex flex-wrap items-center justify-between gap-3 rounded-[1rem] px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-fuchsia-300/25 bg-fuchsia-400/12 text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-100">
                  UFO
                </span>
                <p className="font-brand-display text-xs text-slate-200">Dimadong</p>
              </div>
              <Link
                href="/manual"
                className="trap-ghost-button px-4 py-2 text-sm font-semibold text-slate-100 transition"
              >
                Como se juega
              </Link>
            </div>

            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
              <div className="space-y-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-200/70">Lobby</p>
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
    </>
  );
}
