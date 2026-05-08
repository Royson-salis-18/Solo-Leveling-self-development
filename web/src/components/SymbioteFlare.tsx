import { useEffect, useRef } from "react";

type SymbioteFlareProps = {
  className?: string;
  intensity?: number; // 0..1
};

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  r: number;
  hue: number;
};

export function SymbioteFlare({ className, intensity = 0.85 }: SymbioteFlareProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;
    let mounted = true;
    const parts: P[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      const nw = Math.max(1, Math.floor(r.width));
      const nh = Math.max(1, Math.floor(r.height));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (count: number) => {
      for (let i = 0; i < count; i++) {
        const baseX = w * (0.18 + Math.random() * 0.12);
        const baseY = h * (0.38 + Math.random() * 0.24);
        const hue = 265 + Math.random() * 35; // purple → magenta
        parts.push({
          x: baseX,
          y: baseY,
          vx: (Math.random() - 0.45) * (0.9 + intensity * 1.6),
          vy: -(0.4 + Math.random() * (1.3 + intensity * 1.8)),
          life: 1,
          decay: 0.012 + Math.random() * 0.018,
          r: 6 + Math.random() * 18,
          hue,
        });
      }
    };

    const loop = () => {
      if (!mounted) return;
      resize();
      t++;

      // Fade trail for liquid look
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(6, 4, 14, ${0.22 - intensity * 0.08})`;
      ctx.fillRect(0, 0, w, h);

      // Seed
      const rate = Math.max(1, Math.round(3 + intensity * 4));
      spawn(rate);

      // Vortex-like pull towards center-left
      const cx = w * 0.23;
      const cy = h * 0.52;

      // Draw
      ctx.globalCompositeOperation = "screen";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= p.decay;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }

        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.max(24, Math.hypot(dx, dy));
        const pull = (0.018 + intensity * 0.022) / (dist / 140);
        p.vx += (dx / dist) * pull;
        p.vy += (dy / dist) * pull * 0.55;

        // Wobble to feel "symbiote"
        p.vx += Math.sin((t + p.x) * 0.02) * 0.05;
        p.vy += Math.cos((t + p.y) * 0.018) * 0.05;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.99;

        const a = Math.max(0, Math.min(1, p.life)) * (0.18 + intensity * 0.32);
        const r = p.r * (0.5 + p.life);

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
        g.addColorStop(0, `hsla(${p.hue}, 92%, 72%, ${a})`);
        g.addColorStop(0.35, `hsla(${p.hue + 10}, 92%, 62%, ${a * 0.55})`);
        g.addColorStop(1, `hsla(${p.hue + 20}, 92%, 56%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dark “ink” pass for symbiote edges
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgba(0,0,0,${0.18 + intensity * 0.12})`;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(loop);
    };

    // Prime background
    resize();
    ctx.fillStyle = "rgba(6,4,14,0.0)";
    ctx.fillRect(0, 0, w, h);
    raf = requestAnimationFrame(loop);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}

