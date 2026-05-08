import { useEffect, useRef } from "react";

type LicenseScannerFxProps = {
  className?: string;
  speedPxPerSec?: number;
  intensity?: number; // 0..1
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  life: number;
  decay: number;
};

type Ribbon = {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
};

export function LicenseScannerFx({
  className,
  speedPxPerSec = 140,
  intensity = 0.85,
}: LicenseScannerFxProps) {
  const particleRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const pc = particleRef.current;
    const sc = scannerRef.current;
    if (!pc || !sc) return;
    const pctx = pc.getContext("2d");
    const sctx = sc.getContext("2d");
    if (!pctx || !sctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    const parts: Particle[] = [];
    const ribbons: Ribbon[] = [];
    const glyphCols: { x: number; speed: number; alpha: number }[] = [];

    const resize = () => {
      const parent = pc.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      const nw = Math.max(1, Math.floor(r.width));
      const nh = Math.max(1, Math.floor(r.height));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      for (const c of [pc, sc]) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // initialize ribbons/columns once dimensions are known
      if (ribbons.length === 0) {
        for (let i = 0; i < 7; i++) {
          ribbons.push({
            x: Math.random() * w,
            y: h * (0.15 + Math.random() * 0.7),
            w: 80 + Math.random() * 220,
            h: 8 + Math.random() * 18,
            speed: speedPxPerSec * (0.22 + Math.random() * 0.35),
            alpha: 0.08 + Math.random() * 0.14,
          });
        }
      }
      if (glyphCols.length === 0) {
        for (let i = 0; i < 24; i++) {
          glyphCols.push({
            x: Math.random() * w,
            speed: speedPxPerSec * (0.18 + Math.random() * 0.42),
            alpha: 0.08 + Math.random() * 0.15,
          });
        }
      }
    };

    const spawn = (count: number) => {
      for (let i = 0; i < count; i++) {
        const y0 = h * (0.1 + Math.random() * 0.8);
        const x0 = Math.random() * w;
        const vx = speedPxPerSec * (0.12 + Math.random() * 0.25);
        const vy = (Math.random() - 0.5) * (0.12 + intensity * 0.45);
        parts.push({
          x: x0,
          y: y0,
          vx,
          vy,
          r: 0.7 + Math.random() * (1.8 + intensity * 1.8),
          a: 0.5 + Math.random() * 0.5,
          life: 1,
          decay: 0.006 + Math.random() * 0.014,
        });
      }
    };

    const drawCarouselField = (dt: number) => {
      sctx.clearRect(0, 0, w, h);
      sctx.globalCompositeOperation = "lighter";

      // soft moving horizontal ribbons (carousel vibe)
      for (const rb of ribbons) {
        rb.x += rb.speed * dt;
        if (rb.x > w + rb.w) rb.x = -rb.w;

        const g = sctx.createLinearGradient(rb.x, rb.y, rb.x + rb.w, rb.y);
        g.addColorStop(0, "rgba(139,92,246,0)");
        g.addColorStop(0.35, `rgba(167,139,250,${rb.alpha})`);
        g.addColorStop(0.7, `rgba(34,211,238,${rb.alpha * 0.75})`);
        g.addColorStop(1, "rgba(139,92,246,0)");
        sctx.fillStyle = g;
        sctx.fillRect(rb.x, rb.y, rb.w, rb.h);
      }

      // moving glyph-like columns to mimic data-stream cadence
      sctx.font = "10px monospace";
      sctx.textAlign = "center";
      const glyph = ["#", "|", ":", ".", "x", "0", "1", "7", "A", "R", "I", "S", "E"];
      for (const col of glyphCols) {
        col.x += col.speed * dt;
        if (col.x > w + 20) col.x = -20;
        const rows = 7;
        for (let i = 0; i < rows; i++) {
          const y = h * 0.18 + i * (h * 0.09);
          sctx.fillStyle = `rgba(196,181,253,${Math.max(0.04, col.alpha - i * 0.015)})`;
          sctx.fillText(glyph[(Math.floor(col.x / 13) + i) % glyph.length], col.x, y);
        }
      }

      // subtle vignette mask
      sctx.globalCompositeOperation = "destination-in";
      const mask = sctx.createLinearGradient(0, 0, 0, h);
      mask.addColorStop(0, "rgba(255,255,255,0)");
      mask.addColorStop(0.2, "rgba(255,255,255,1)");
      mask.addColorStop(0.8, "rgba(255,255,255,1)");
      mask.addColorStop(1, "rgba(255,255,255,0)");
      sctx.fillStyle = mask;
      sctx.fillRect(0, 0, w, h);
    };

    const loop = () => {
      resize();
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      // particle trail fade
      pctx.globalCompositeOperation = "source-over";
      pctx.fillStyle = `rgba(6,4,14,${0.18})`;
      pctx.fillRect(0, 0, w, h);

      // spawn particles continuously (no scanning line)
      const spawnCount = Math.max(2, Math.round(5 + intensity * 7));
      spawn(spawnCount);

      // draw particles
      pctx.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= p.decay;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt * 60;
        p.y += p.vy + Math.sin((p.x + now * 0.03) * 0.02) * 0.25;
        p.vx *= 0.99;
        p.vy *= 0.99;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
        if (p.x > w + 40) p.x = -20;

        const a = p.a * p.life * (0.35 + intensity * 0.45);
        const r = p.r * (0.7 + p.life);
        const g = pctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.18, `rgba(196,181,253,${a * 0.9})`);
        g.addColorStop(0.55, `rgba(139,92,246,${a * 0.55})`);
        g.addColorStop(1, "rgba(139,92,246,0)");
        pctx.fillStyle = g;
        pctx.beginPath();
        pctx.arc(p.x, p.y, r * 4.2, 0, Math.PI * 2);
        pctx.fill();
      }

      drawCarouselField(dt);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [speedPxPerSec, intensity]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={particleRef} className="lsfx-particles" />
      <canvas ref={scannerRef} className="lsfx-scanner" />
    </div>
  );
}

