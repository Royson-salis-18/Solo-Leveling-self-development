import { useEffect, useRef } from "react";

type SoloRainOverlayProps = {
  active: boolean;
  hudText?: string;
  tone?: "entry" | "levelup";
  className?: string;
};

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ".split(
  ""
);

type DropPoint = { x: number; y: number; char: string };

class Drop {
  x = 0;
  y = 0;
  z = 0;
  scale = 1;
  speed = 1;
  history: DropPoint[] = [];
  maxHistory = 12;
  color = "#0fa";

  reset(w: number, h: number, randomY = false, colorTone: "entry" | "levelup" = "entry") {
    this.z = Math.random() * 2000 + 100;
    this.scale = 1000 / this.z;
    this.x = Math.random() * w * 3 - w;
    this.y = randomY ? Math.random() * h * 2 - h : -220;
    this.speed = (Math.random() * 2 + 1) * this.scale * 3;
    this.history = [];
    this.maxHistory = Math.floor(Math.random() * 20 + 10);
    this.color = Math.random() > 0.18
      ? (colorTone === "levelup" ? "#a78bfa" : "#0fd9c4")
      : "#8b5cf6";
  }

  update(w: number, h: number) {
    this.history.unshift({
      x: this.x,
      y: this.y,
      char: CHARS[Math.floor(Math.random() * CHARS.length)],
    });
    if (this.history.length > this.maxHistory) this.history.pop();
    this.y += this.speed;
    if (this.y > h * 1.5) this.reset(w, h, false);
  }
}

export function SoloRainOverlay({
  active,
  hudText = "DATA STREAM [ACTIVE]",
  tone = "entry",
  className = "",
}: SoloRainOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<Drop[]>([]);
  const rafRef = useRef<number | null>(null);
  const shiftXRef = useRef(0);
  const targetShiftXRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let mounted = true;

    const init = () => {
      w = Math.floor(window.innerWidth * 1.5);
      h = Math.floor(window.innerHeight * 1.5);
      canvas.width = w;
      canvas.height = h;
      const count = Math.min(320, Math.floor(w / 10));
      dropsRef.current = Array.from({ length: count }, () => {
        const d = new Drop();
        d.reset(w, h, true, tone);
        return d;
      });
    };

    const render = () => {
      if (!mounted) return;
      if (!active) {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = "rgba(1, 4, 9, 0.42)";
      ctx.fillRect(0, 0, w, h);
      shiftXRef.current += (targetShiftXRef.current - shiftXRef.current) * 0.05;

      // Far -> near for depth
      dropsRef.current.sort((a, b) => b.z - a.z);
      for (const drop of dropsRef.current) {
        drop.update(w, h);
        for (let i = 0; i < drop.history.length; i++) {
          const p = drop.history[i];
          const opacity = 1 - i / drop.history.length;
          const alphaHex = Math.floor(opacity * 255)
            .toString(16)
            .padStart(2, "0");
          ctx.fillStyle = i === 0 ? "#ffffff" : `${drop.color}${alphaHex}`;
          ctx.font = `${Math.max(8, 20 * drop.scale)}px monospace`;
          ctx.textAlign = "center";
          const px = p.x + shiftXRef.current * drop.scale;
          if (i === 0) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = drop.color;
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.fillText(p.char, px, p.y - i * 20 * drop.scale);
        }
      }
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(render);
    };

    const onResize = () => init();
    const onMove = (e: MouseEvent) => {
      targetShiftXRef.current = (window.innerWidth / 2 - e.clientX) * 0.5;
      const rotY = (e.clientX - window.innerWidth / 2) * 0.01;
      canvas.style.transform = `translate(-50%, -50%) rotateX(20deg) rotateY(${rotY}deg) scale(1)`;
    };

    init();
    render();
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);
    return () => {
      mounted = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [active, tone]);

  return (
    <div className={`solo-rain-overlay ${active ? "is-active" : ""} ${className}`}>
      <canvas ref={canvasRef} className="rain-canvas" />
      <div className="vignette" />
      <div className="hologram-overlay">
        <div className="hud-text">{hudText}</div>
      </div>
    </div>
  );
}

