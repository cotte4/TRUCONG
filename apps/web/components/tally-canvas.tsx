"use client";

import { useCallback, useEffect, useRef } from "react";

// Layout
const CANVAS_PAD = 16;
const GROUP_W = 50;
const GROUP_H = 72;
const GROUP_GAP = 14;
const CANVAS_H = GROUP_H + CANVAS_PAD * 2;
const ANIM_MS = 380;

const COLORS = {
  A: { line: "#67f6ff", glow: "rgba(103,246,255,0.55)" },
  B: { line: "#8efb45", glow: "rgba(142,251,69,0.50)" },
} as const;

function jitter(range = 2.5): number {
  return (Math.random() - 0.5) * range;
}

type StrokeCoords = readonly [number, number, number, number];

function buildStroke(strokeIndex: number): StrokeCoords {
  const groupIndex = Math.floor(strokeIndex / 5);
  const markIndex = strokeIndex % 5;
  const gx = CANVAS_PAD + groupIndex * (GROUP_W + GROUP_GAP);
  const gy = CANVAS_PAD;

  if (markIndex < 4) {
    const spacing = (GROUP_W - 10) / 3;
    const x = gx + 5 + markIndex * spacing + jitter(1);
    return [x, gy + 5 + jitter(1.5), x, gy + GROUP_H - 5 + jitter(1.5)] as const;
  }

  // Diagonal slash across the group
  return [
    gx - 5 + jitter(2),
    gy + GROUP_H * 0.07 + jitter(2),
    gx + GROUP_W + 5 + jitter(2),
    gy + GROUP_H * 0.93 + jitter(2),
  ] as const;
}

interface TallyCanvasProps {
  team: "A" | "B";
  count: number;
  targetScore: number;
  onAdd: () => void;
  onUndo: () => void;
}

export function TallyCanvas({ team, count, targetScore, onAdd, onUndo }: TallyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<StrokeCoords[]>([]);
  const rafRef = useRef<number | null>(null);
  const prevCountRef = useRef(0);

  const { line, glow } = COLORS[team];
  const maxGroups = Math.max(1, Math.ceil(targetScore / 5));
  const logicalW = CANVAS_PAD * 2 + maxGroups * GROUP_W + (maxGroups - 1) * GROUP_GAP;

  const redraw = useCallback(
    (animProgress = 1, animIdx = -1) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.clearRect(0, 0, logicalW, CANVAS_H);

      strokesRef.current.forEach((stroke, i) => {
        const p = i === animIdx ? animProgress : 1;
        const [x1, y1, x2, y2] = stroke;
        const tx = x1 + (x2 - x1) * p;
        const ty = y1 + (y2 - y1) * p;

        ctx.save();
        ctx.strokeStyle = line;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.shadowColor = glow;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      });
    },
    [line, glow, logicalW],
  );

  const animateLast = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const idx = strokesRef.current.length - 1;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / ANIM_MS, 1);
      const eased = 1 - (1 - t) * (1 - t); // ease-out quad
      redraw(eased, idx);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [redraw]);

  // Initialize canvas once on mount — scales for DPR, draws existing strokes without animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = logicalW * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${CANVAS_H}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;

    strokesRef.current = Array.from({ length: count }, (_, i) => buildStroke(i));
    prevCountRef.current = count;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to count changes after mount
  useEffect(() => {
    const prev = prevCountRef.current;
    if (prev === count) return;
    prevCountRef.current = count;

    if (count > prev) {
      for (let i = prev; i < count; i++) {
        strokesRef.current.push(buildStroke(i));
      }
      animateLast();
    } else {
      strokesRef.current.length = count;
      redraw();
    }
  }, [count, animateLast, redraw]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.24em] ${
            team === "A" ? "text-cyan-200/70" : "text-lime-200/70"
          }`}
        >
          Equipo {team}
        </p>
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl font-black tabular-nums ${
              team === "A" ? "text-cyan-100" : "text-lime-100"
            }`}
          >
            {count}
          </span>
          <button
            type="button"
            onClick={onUndo}
            disabled={count === 0}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-30"
          >
            −1
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        aria-label={`Sumar un punto al equipo ${team}`}
        className={`group relative w-full rounded-[1.25rem] border bg-slate-950/80 transition active:scale-[0.99] ${
          team === "A"
            ? "border-cyan-300/15 hover:border-cyan-300/30"
            : "border-lime-300/15 hover:border-lime-300/30"
        }`}
      >
        <div className="overflow-x-auto p-3">
          <canvas ref={canvasRef} className="block" />
        </div>
        {count === 0 && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.22em] text-white/22 transition group-hover:text-white/40">
            Tocá para sumar
          </span>
        )}
      </button>
    </div>
  );
}
