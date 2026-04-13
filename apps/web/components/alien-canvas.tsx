"use client";

import { useCallback, useEffect, useRef } from "react";

// Layout
const UFO_W = 30;
const UFO_H = 22;
const UFO_STEP = 36; // center-to-center within group
const GROUP_GAP = 22;
const CANVAS_PAD = 14;
const BEAM_H = 24;
const CANVAS_H = CANVAS_PAD + UFO_H + BEAM_H + CANVAS_PAD;
const ANIM_MS = 480;
const UFO_START_Y = -(UFO_H + CANVAS_PAD);
const UFO_FINAL_Y = CANVAS_PAD + UFO_H / 2;

const COLORS = {
  A: {
    body: "#67f6ff",
    glow: "rgba(103,246,255,0.6)",
    dome: "rgba(103,246,255,0.18)",
    beam: "rgba(103,246,255,0.25)",
  },
  B: {
    body: "#8efb45",
    glow: "rgba(142,251,69,0.55)",
    dome: "rgba(142,251,69,0.15)",
    beam: "rgba(142,251,69,0.22)",
  },
} as const;

const LIGHT_COLORS = ["#ff2bd6", "#67f6ff", "#8efb45", "#a855f7", "#ff2bd6"];

function groupW(): number {
  return 4 * UFO_STEP + UFO_W;
}

function computeLogicalW(targetScore: number): number {
  const groups = Math.max(1, Math.ceil(targetScore / 5));
  return CANVAS_PAD * 2 + groups * groupW() + (groups - 1) * GROUP_GAP;
}

function getUFOX(index: number): number {
  const g = Math.floor(index / 5);
  const m = index % 5;
  return CANVAS_PAD + g * (groupW() + GROUP_GAP) + m * UFO_STEP + UFO_W / 2;
}

type C = { body: string; glow: string; dome: string; beam: string };

function drawUFO(ctx: CanvasRenderingContext2D, cx: number, cy: number, c: C, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 8;

  // Dome
  ctx.beginPath();
  ctx.ellipse(cx, cy, UFO_W * 0.2, UFO_H * 0.36, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = c.dome;
  ctx.fill();
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Saucer body
  ctx.beginPath();
  ctx.ellipse(cx, cy + UFO_H * 0.15, UFO_W * 0.5, UFO_H * 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.dome;
  ctx.fill();
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Bottom ring
  ctx.beginPath();
  ctx.ellipse(cx, cy + UFO_H * 0.29, UFO_W * 0.28, UFO_H * 0.1, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Lights
  const offsets = [-UFO_W * 0.34, -UFO_W * 0.17, 0, UFO_W * 0.17, UFO_W * 0.34];
  offsets.forEach((dx, i) => {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + UFO_H * 0.21, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = LIGHT_COLORS[i];
    ctx.shadowColor = LIGHT_COLORS[i];
    ctx.shadowBlur = 5;
    ctx.fill();
  });

  ctx.restore();
}

function drawGroupSeal(ctx: CanvasRenderingContext2D, groupIndex: number, c: C) {
  // Glowing underline to mark a complete group of 5
  const x0 = CANVAS_PAD + groupIndex * (groupW() + GROUP_GAP) + UFO_W * 0.05;
  const x1 = x0 + groupW() - UFO_W * 0.1;
  const y = UFO_FINAL_Y + UFO_H * 0.44;

  ctx.save();
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();

  // Small beam gradient below the line
  const grad = ctx.createLinearGradient(0, y, 0, y + BEAM_H - 4);
  grad.addColorStop(0, c.beam);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  const cx = (x0 + x1) / 2;
  const halfW = (x1 - x0) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.lineTo(cx + halfW * 0.6, y + BEAM_H - 4);
  ctx.lineTo(cx - halfW * 0.6, y + BEAM_H - 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

type UFOAnim = { x: number; done: boolean; startTime: number };

interface AlienCanvasProps {
  team: "A" | "B";
  count: number;
  targetScore: number;
  onAdd: () => void;
  onUndo: () => void;
}

export function AlienCanvas({ team, count, targetScore, onAdd, onUndo }: AlienCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animsRef = useRef<UFOAnim[]>([]);
  const rafRef = useRef<number | null>(null);
  const prevCountRef = useRef(0);

  const c = COLORS[team];
  const logicalW = computeLogicalW(targetScore);

  const render = useCallback(
    (now: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.clearRect(0, 0, logicalW, CANVAS_H);

      // Group seals (behind UFOs)
      const doneCount = animsRef.current.reduce((n, a) => n + (a.done ? 1 : 0), 0);
      const completeGroups = Math.floor(doneCount / 5);
      for (let g = 0; g < completeGroups; g++) {
        drawGroupSeal(ctx, g, c);
      }

      // UFOs
      let hasAnimating = false;
      animsRef.current.forEach((anim) => {
        if (anim.done) {
          drawUFO(ctx, anim.x, UFO_FINAL_Y, c);
        } else {
          const elapsed = now - anim.startTime;
          if (elapsed < 0) {
            // Not started yet (stagger delay)
            hasAnimating = true;
            return;
          }
          const t = Math.min(elapsed / ANIM_MS, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          const y = UFO_START_Y + (UFO_FINAL_Y - UFO_START_Y) * eased;
          drawUFO(ctx, anim.x, y, c, Math.min(eased * 2, 1));
          if (t >= 1) {
            anim.done = true;
          } else {
            hasAnimating = true;
          }
        }
      });

      if (hasAnimating) {
        rafRef.current = requestAnimationFrame((t) => render(t));
      }
    },
    [c, logicalW],
  );

  // Mount: init canvas + draw existing count without animation
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

    animsRef.current = Array.from({ length: count }, (_, i) => ({
      x: getUFOX(i),
      done: true,
      startTime: 0,
    }));
    prevCountRef.current = count;
    render(performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count changes
  useEffect(() => {
    const prev = prevCountRef.current;
    if (prev === count) return;
    prevCountRef.current = count;

    if (count > prev) {
      const now = performance.now();
      for (let i = prev; i < count; i++) {
        animsRef.current.push({
          x: getUFOX(i),
          done: false,
          startTime: now + (i - prev) * 70,
        });
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame((t) => render(t));
    } else {
      animsRef.current.length = count;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      render(performance.now());
    }
  }, [count, render]);

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
        className={`group relative w-full overflow-x-auto rounded-[1.25rem] border bg-slate-950/80 transition active:scale-[0.99] ${
          team === "A"
            ? "border-cyan-300/15 hover:border-cyan-300/30"
            : "border-lime-300/15 hover:border-lime-300/30"
        }`}
      >
        <div className="p-3">
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
