"use client";

import { useCallback, useEffect, useRef } from "react";

const COLORS = {
  A: { pen: "#67f6ff", glow: "rgba(103,246,255,0.55)", border: "border-cyan-300/18 hover:border-cyan-300/32", label: "text-cyan-200/70" },
  B: { pen: "#8efb45", glow: "rgba(142,251,69,0.50)", border: "border-lime-300/18 hover:border-lime-300/32", label: "text-lime-200/70" },
} as const;

type Point = [number, number];

function FreePanel({ team }: { team: "A" | "B" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const c = COLORS[team];

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = 160;

    // Preserve existing drawing scaled — skip if size unchanged
    if (canvas.width === w * dpr && canvas.height === h * dpr) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    initCanvas();

    const observer = new ResizeObserver(initCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [initCanvas]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getPos(e);

    // Draw a dot on tap
    const ctx = ctxRef.current;
    if (!ctx) return;
    const [x, y] = lastPointRef.current;
    ctx.save();
    ctx.fillStyle = c.pen;
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !ctxRef.current || !lastPointRef.current) return;

    const ctx = ctxRef.current;
    const [x, y] = getPos(e);
    const [lx, ly] = lastPointRef.current;

    ctx.save();
    ctx.strokeStyle = c.pen;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    lastPointRef.current = [x, y];
  };

  const onPointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clear = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${c.label}`}>
          Equipo {team}
        </p>
        <button
          type="button"
          onClick={clear}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Limpiar
        </button>
      </div>

      <div ref={containerRef} className={`rounded-[1.25rem] border bg-slate-950/80 transition ${c.border}`}>
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair rounded-[1.25rem]"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}

export function FreeCanvas() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-slate-400/80 leading-relaxed">
        Dibujá los palitos a mano. El canvas no lleva puntaje — es tuyo.
      </p>
      <FreePanel team="A" />
      <FreePanel team="B" />
    </div>
  );
}
