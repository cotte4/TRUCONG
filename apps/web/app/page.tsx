import { HomeClient } from "@/components/home-client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">

        {/* Nav */}
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/72 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            {/* Tiny UFO */}
            <span className="text-xl ufo-pulse inline-block">🛸</span>
            <div>
              <p className="font-brand-display text-xs text-slate-300">Dimadong</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/manual"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Cómo se juega
            </Link>
            <Link
              href="#crear-sala"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Crear sala
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16">
          {/* Text */}
          <div className="flex-1 space-y-6">
            <h1 className="font-brand-display text-5xl text-white sm:text-6xl lg:text-7xl">
              Truco con{" "}
              <span className="text-cyan-300">aliens,</span>
              <br />
              DIMADONGS y<br />
              <span className="text-rose-400">caos</span> controlado.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Armás la sala, pasás el código y arranca la mano — con las reglas de siempre y los BONGS que nunca estuvieron pero deberían haber estado.
            </p>
            <div className="flex flex-wrap gap-2">
              {["?? Aliens", "?? DIMADONG", "?? BONG", "?? Sala privada", "? Tiempo real"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
                >
                  {chip}
                </span>
              ))}
            </div>
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

          {/* Alien illustration */}
          <div className="relative hidden lg:flex items-center justify-center w-72 h-72 flex-shrink-0">
            {/* Glow rings */}
            <div className="absolute inset-0 rounded-full bg-cyan-400/5 blur-3xl" />
            <div className="absolute inset-8 rounded-full border border-cyan-400/10" />
            <div className="absolute inset-16 rounded-full border border-cyan-400/8" />
            {/* UFO SVG */}
            <svg
              viewBox="0 0 200 200"
              className="relative w-56 h-56 ufo-pulse"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Beam */}
              <polygon
                points="82,120 118,120 130,180 70,180"
                fill="url(#beamGrad)"
                className="alien-beam"
              />
              {/* UFO body */}
              <ellipse cx="100" cy="108" rx="52" ry="14" fill="#1e3a5f" stroke="#67e8f9" strokeWidth="1.5" />
              {/* UFO dome */}
              <ellipse cx="100" cy="100" rx="28" ry="20" fill="#0f2440" stroke="#67e8f9" strokeWidth="1.5" />
              {/* Dome glass sheen */}
              <ellipse cx="93" cy="95" rx="8" ry="5" fill="#67e8f9" opacity="0.15" />
              {/* Alien inside dome */}
              <ellipse cx="100" cy="100" rx="10" ry="12" fill="#4ade80" className="alien-bob" />
              <circle cx="97" cy="97" r="2" fill="#052e16" />
              <circle cx="103" cy="97" r="2" fill="#052e16" />
              <path d="M97 103 Q100 106 103 103" stroke="#052e16" strokeWidth="1" fill="none" />
              {/* Antennae */}
              <line x1="96" y1="88" x2="90" y2="80" stroke="#4ade80" strokeWidth="1.5" />
              <circle cx="90" cy="79" r="2" fill="#4ade80" />
              <line x1="104" y1="88" x2="110" y2="80" stroke="#4ade80" strokeWidth="1.5" />
              <circle cx="110" cy="79" r="2" fill="#4ade80" />
              {/* Lights on saucer rim */}
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
            {/* Card floating near UFO */}
            <div className="absolute bottom-4 -right-4 rounded-2xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur text-xs text-slate-300 whitespace-nowrap shadow-xl">
              ?? DIMADONG activado
            </div>
          </div>
        </section>

        {/* Room entry */}
        <section id="crear-sala" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Entrada</p>
              <h2 className="font-brand-display mt-2 text-3xl text-white">Crear o unirse a una sala</h2>
            </div>
          </div>
          <HomeClient />
        </section>

      </div>
    </main>
  );
}
