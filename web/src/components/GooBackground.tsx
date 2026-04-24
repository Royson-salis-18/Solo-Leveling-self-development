import React, { useEffect, useRef } from 'react';

export function GooBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let GW: number, GH: number;
    let animationFrameId: number;
    let mounted = true;

    const rsz = () => {
      GW = canvas.width = window.innerWidth;
      GH = canvas.height = Math.max(window.innerHeight, document.body.scrollHeight + 300);
    };

    window.addEventListener('resize', () => setTimeout(rsz, 100));
    rsz();

    const blobs = Array.from({ length: 7 }, () => ({
      x: Math.random() * GW,
      y: Math.random() * GH,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 150 + Math.random() * 250,
      ph: Math.random() * Math.PI * 2,
      sp: 0.003 + Math.random() * 0.005
    }));

    const tendrils = Array.from({ length: 12 }, () => ({
      x: Math.random() * GW,
      y: Math.random() * GH,
      wb: Math.random() * Math.PI * 2,
      sp: 0.003 + Math.random() * 0.005,
      len: 100 + Math.random() * 180,
      w: 1.5 + Math.random() * 5,
      al: 0.05 + Math.random() * 0.1
    }));

    let gt = 0;

    const loop = () => {
      if (!mounted) return;
      gt++;
      ctx.clearRect(0, 0, GW, GH);

      // Blobs
      for (const b of blobs) {
        b.ph += b.sp;
        b.x += b.vx + Math.sin(b.ph * 0.7) * 0.3;
        b.y += b.vy + Math.cos(b.ph * 0.5) * 0.3;
        if (b.x < -b.r) b.x = GW + b.r;
        if (b.x > GW + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = GH + b.r;
        if (b.y > GH + b.r) b.y = -b.r;
        
        const rr = b.r * (0.85 + Math.sin(b.ph) * 0.15);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
        // Using very subtle dark blobs to create depth
        g.addColorStop(0, 'rgba(168, 168, 255, 0.04)');
        g.addColorStop(0.5, 'rgba(111, 60, 255, 0.02)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tendrils (Shadowy energy)
      for (const td of tendrils) {
        td.wb += td.sp;
        const pts: [number, number][] = [];
        let cx = td.x, cy = td.y;
        for (let i = 0; i < 15; i++) {
          const t = i / 15;
          pts.push([cx + Math.sin(td.wb + t * 3) * 22 * (1 - t), cy]);
          cy += td.len / 15;
          cx += Math.sin(td.wb * 0.5 + i) * 3;
        }
        
        const tip = pts[pts.length - 1];
        const br = td.w * 2 * (0.7 + Math.sin(td.wb * 2) * 0.3);
        const bg = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], br * 2.5);
        bg.addColorStop(0, `rgba(168, 168, 255, ${td.al * 1.5})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(tip[0], tip[1], br * 2.5, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < pts.length - 1; i++) {
          const t = i / (pts.length - 1);
          ctx.lineWidth = td.w * (1 - t * 0.7);
          ctx.strokeStyle = `rgba(168, 168, 255, ${td.al * (1 - t * 0.4)})`;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[i][0], pts[i][1]);
          ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
          ctx.stroke();
        }
        
        td.x += Math.sin(td.wb * 0.3) * 0.4;
        td.y += Math.cos(td.wb * 0.2) * 0.15;
        if (td.x < -100) td.x = GW + 100;
        if (td.x > GW + 100) td.x = -100;
        if (td.y < -td.len) td.y = GH;
        if (td.y > GH + td.len) td.y = -td.len;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', rsz);
    };
  }, []);

  return <canvas id="goo" ref={canvasRef} />;
}
