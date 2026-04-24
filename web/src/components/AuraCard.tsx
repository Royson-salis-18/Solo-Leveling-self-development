import React, { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';

export type EffectType = 'shadow' | 'flame' | 'smoke' | 'lightning';

interface AuraCardProps {
  name: string;
  rankLabel: string;
  rarityColor: string;
  isCollected: boolean;
  effectType?: EffectType;
  col?: number[][];
  glow?: string;
  icon?: React.ReactNode | string;
  sub?: string;
  bonus?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function AuraCard({
  name,
  rankLabel,
  rarityColor,
  isCollected,
  effectType = 'shadow',
  col = [[80, 20, 220], [60, 0, 180], [100, 40, 240]],
  glow = '70,10,200',
  icon = '◆',
  sub = 'Shadow Extraction',
  bonus = 0,
  label,
  className = "",
  style,
  children
}: AuraCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Always-on particles — locked = dim, unlocked = vivid
  const alphaScale = isCollected ? 1.0 : 0.75;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let w = 0, h = 0;
    let mounted = true;

    const resize = () => {
      if (!containerRef.current || !canvas) return;
      const r = containerRef.current.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (w !== r.width || h !== r.height) {
        w = canvas.width = r.width;
        h = canvas.height = r.height;
      }
    };

    const type = effectType;

    /* ── EFFECT HELPERS ── */
    let pts: any[] = [];
    let tendrils: any[] = [];
    let bolts: any[] = [];
    let orbs: any[] = [];
    let t = 0;

    const spawnFlame = (init: boolean) => {
      const c = col[Math.floor(Math.random() * col.length)];
      pts.push({
        x: w * 0.1 + Math.random() * w * 0.8,
        y: init ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(Math.random() * 2.2 + 0.8),
        sz: Math.random() * 10 + 4,
        a: 0, mA: (Math.random() * 0.55 + 0.2) * alphaScale,
        life: 0, mL: Math.random() * 70 + 50,
        wb: Math.random() * Math.PI * 2, c
      });
    };

    const spawnShadow = (init: boolean) => {
      const c = col[Math.floor(Math.random() * col.length)];
      pts.push({
        x: Math.random() * w,
        y: init ? Math.random() * h : h + 5,
        vx: (Math.random() - 0.5) * 2,
        vy: -(Math.random() * 1.2 + 0.3),
        sz: Math.random() * 14 + 6,
        a: 0, mA: (Math.random() * 0.45 + 0.15) * alphaScale,
        life: 0, mL: Math.random() * 100 + 80,
        wb: Math.random() * Math.PI * 2, spread: Math.random() * 0.5 + 0.8, c
      });
    };

    const spawnSmoke = (init: boolean) => {
      const c = col[Math.floor(Math.random() * col.length)];
      pts.push({
        x: w * 0.05 + Math.random() * w * 0.9,
        y: init ? Math.random() * h : h + 5,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(Math.random() * 0.7 + 0.2),
        sz: Math.random() * 22 + 12,
        a: 0, mA: (Math.random() * 0.3 + 0.1) * alphaScale,
        life: 0, mL: Math.random() * 140 + 100,
        wb: Math.random() * Math.PI * 2, rot: Math.random() * 0.02 - 0.01, c
      });
    };

    const spawnBolt = () => {
      const x = w * 0.1 + Math.random() * w * 0.8;
      const segs: any[] = []; let cx = x, cy = 0;
      while (cy < h + 20) {
        const nx = cx + (Math.random() - 0.5) * 55;
        const ny = cy + Math.random() * 28 + 12;
        segs.push([cx, cy, nx, ny]); cx = nx; cy = ny;
      }
      const branches: any[] = [];
      if (segs.length > 3) {
        const bi = Math.floor(segs.length * 0.3 + Math.random() * segs.length * 0.4);
        const [, , bx2, by2] = segs[bi];
        let bcx = bx2, bcy = by2;
        const bsegs: any[] = [];
        for (let i = 0; i < 4; i++) {
          const bnx = bcx + (Math.random() - 0.5) * 40;
          const bny = bcy + Math.random() * 20 + 8;
          bsegs.push([bcx, bcy, bnx, bny]); bcx = bnx; bcy = bny;
        }
        branches.push(bsegs);
      }
      const [r, g, b] = col[Math.floor(Math.random() * col.length)];
      bolts.push({ segs, branches, alpha: 1 * alphaScale, life: 0, maxLife: 14, r, g, b });
    };

    const spawnOrb = () => {
      const [r, g, b] = col[0];
      orbs.push({
        x: w * 0.2 + Math.random() * w * 0.6,
        y: h * 0.3 + Math.random() * h * 0.5,
        r: Math.random() * 12 + 5,
        alpha: 0, mA: (Math.random() * 0.5 + 0.2) * alphaScale,
        life: 0, mL: Math.random() * 60 + 40,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        col: [r, g, b]
      });
    };

    // Pre-spawn particles for smoother start
    for (let i = 0; i < 20; i++) {
      if (type === 'flame') spawnFlame(true);
      else if (type === 'shadow') spawnShadow(true);
      else if (type === 'smoke') spawnSmoke(true);
    }
    if (type === 'shadow') {
      for (let i = 0; i < 5; i++) {
        tendrils.push({ x: w * 0.1 + Math.random() * w * 0.8, phase: Math.random() * Math.PI * 2, height: Math.random() * 50 + 30 });
      }
    }
    if (type === 'lightning') {
      for (let i = 0; i < 4; i++) spawnOrb();
    }

    const loop = () => {
      if (!mounted) return;
      resize(); // Ensure size is always current
      
      if (w === 0 || h === 0) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      t++;
      ctx.clearRect(0, 0, w, h);

      /* ── FLAME ── */
      if (type === 'flame') {
        if (Math.random() < 0.5) spawnFlame(false);
        const pulse = Math.sin(t * 0.06) * 0.5 + 0.5;
        const bg = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.9);
        bg.addColorStop(0, `rgba(${glow},${0.15 * pulse * alphaScale})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        pts = pts.filter(p => p.life < p.mL);
        for (const p of pts) {
          p.life++; p.wb += 0.08;
          const tt = p.life / p.mL;
          p.a = tt < 0.15 ? (tt / 0.15) * p.mA : p.mA * (1 - (tt - 0.15) / 0.85);
          p.x += p.vx + Math.sin(p.wb) * 0.7; p.y += p.vy;
          const sz = p.sz * (1 - tt * 0.5);
          const [r, g, b] = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.wb) * 0.3);
          const fg = ctx.createRadialGradient(0, 0, 0, 0, -sz, sz * 2);
          fg.addColorStop(0, `rgba(${r},${g},${b},${p.a})`);
          fg.addColorStop(0.5, `rgba(${r},${g},${b},${p.a * 0.4})`);
          fg.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.6, sz * 1.7, 0, 0, Math.PI * 2);
          ctx.fillStyle = fg; ctx.fill(); ctx.restore();
        }
        if (Math.random() < (isCollected ? 0.015 : 0.008)) {
          const gy = Math.random() * h;
          const [r, g, b] = col[0];
          ctx.fillStyle = `rgba(${r},${g},${b},${isCollected ? 0.12 : 0.05})`;
          ctx.fillRect(0, gy, w, Math.random() * 4 + 1);
        }
      }

      /* ── SHADOW ── */
      else if (type === 'shadow') {
        const pulse = Math.sin(t * 0.04) * 0.5 + 0.5;
        const bg = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h);
        bg.addColorStop(0, `rgba(${glow},${0.2 * pulse * alphaScale})`);
        bg.addColorStop(0.5, `rgba(${glow},${0.06 * pulse * alphaScale})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        for (const td of tendrils) {
          const tx = td.x + Math.sin(t * 0.03 + td.phase) * 15;
          const th = td.height * (0.7 + Math.sin(t * 0.05 + td.phase) * 0.3);
          const [r, g, b] = col[0];
          const tg = ctx.createLinearGradient(tx, h, tx, h - th);
          tg.addColorStop(0, `rgba(${r},${g},${b},${0.5 * pulse * alphaScale})`);
          tg.addColorStop(0.5, `rgba(${r},${g},${b},${0.2 * pulse * alphaScale})`);
          tg.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = tg; ctx.beginPath();
          const tw2 = 6 + Math.sin(t * 0.07 + td.phase) * 3;
          ctx.ellipse(tx, h - th * 0.3, tw2, th, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(tx + Math.sin(t * 0.04 + td.phase) * 8, h - th * 0.7, tw2 * 0.5, tw2, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${0.3 * pulse * alphaScale})`; ctx.fill();
        }
        if (Math.random() < 0.4) spawnShadow(false);
        pts = pts.filter(p => p.life < p.mL);
        for (const p of pts) {
          p.life++; p.wb += 0.05;
          const tt = p.life / p.mL;
          p.a = tt < 0.1 ? (tt / 0.1) * p.mA : p.mA * (1 - (tt - 0.1) / 0.9);
          p.x += p.vx + Math.sin(p.wb) * 1.5; p.y += p.vy;
          const sz = p.sz * (1 + tt * 0.3);
          const [r, g, b] = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.wb * 0.3);
          ctx.globalAlpha = p.a; ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath(); ctx.ellipse(0, 0, sz * p.spread, sz, 0, 0, Math.PI * 2); ctx.fill();
          const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 0.5);
          sg.addColorStop(0, `rgba(${Math.min(r + 60, 255)},${Math.min(g + 40, 255)},${Math.min(b + 80, 255)},${p.a * 0.4})`);
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.5, sz * 0.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (Math.random() < (isCollected ? 0.02 : 0.01)) {
          const gy = Math.random() * h;
          ctx.fillStyle = `rgba(${glow},${isCollected ? 0.1 : 0.04})`; ctx.fillRect(0, gy, w, Math.random() * 3 + 1);
        }
      }

      /* ── SMOKE ── */
      else if (type === 'smoke') {
        if (Math.random() < 0.35) spawnSmoke(false);
        const pulse = Math.sin(t * 0.03) * 0.5 + 0.5;
        const bg = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.8);
        bg.addColorStop(0, `rgba(${glow},${0.06 * pulse * alphaScale})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        pts = pts.filter(p => p.life < p.mL);
        for (const p of pts) {
          p.life++; p.wb += p.rot;
          const tt = p.life / p.mL;
          if (tt < 0.2) p.a = (tt / 0.2) * p.mA;
          else if (tt < 0.7) p.a = p.mA;
          else p.a = p.mA * (1 - (tt - 0.7) / 0.3);
          p.x += p.vx + Math.sin(t * 0.01 + p.wb) * 0.5; p.y += p.vy;
          const sz = p.sz * (1 + tt * 1.2);
          const [r, g, b] = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.wb);
          for (let layer = 0; layer < 3; layer++) {
            const lsz = sz * (0.6 + layer * 0.3);
            const la = p.a * (1 - layer * 0.25);
            const sg = ctx.createRadialGradient(layer * 4, layer * 3, 0, 0, 0, lsz);
            sg.addColorStop(0, `rgba(${r},${g},${b},${la})`);
            sg.addColorStop(0.6, `rgba(${r},${g},${b},${la * 0.5})`);
            sg.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.beginPath(); ctx.arc(layer * 5, 0, lsz, 0, Math.PI * 2);
            ctx.fillStyle = sg; ctx.fill();
          }
          ctx.restore();
        }
        if (Math.random() < (isCollected ? 0.01 : 0.005)) {
          const gy = Math.random() * h;
          ctx.fillStyle = `rgba(${glow},${isCollected ? 0.08 : 0.03})`; ctx.fillRect(0, gy, w, Math.random() * 2 + 1);
        }
      }

      /* ── LIGHTNING ── */
      else if (type === 'lightning') {
        const pulse = Math.sin(t * 0.07) * 0.5 + 0.5;
        const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h);
        bg.addColorStop(0, `rgba(${glow},${0.1 * pulse * alphaScale})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        if (Math.random() < 0.03) spawnOrb();
        orbs = orbs.filter(o => o.life < o.mL);
        for (const o of orbs) {
          o.life++; const tt = o.life / o.mL;
          o.alpha = tt < 0.2 ? (tt / 0.2) * o.mA : o.mA * (1 - (tt - 0.2) / 0.8);
          o.x += o.vx; o.y += o.vy;
          const [r, g, b] = o.col;
          const og = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 2);
          og.addColorStop(0, `rgba(${r},${g},${b},${o.alpha})`);
          og.addColorStop(0.4, `rgba(${r},${g},${b},${o.alpha * 0.5})`);
          og.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = og; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 2, 0, Math.PI * 2); ctx.fill();
        }
        if (Math.random() < 0.08) spawnBolt();
        bolts = bolts.filter(b => b.life < b.maxLife);
        for (const bolt of bolts) {
          bolt.life++; bolt.alpha *= 0.72;
          ctx.save(); ctx.globalAlpha = bolt.alpha;
          ctx.strokeStyle = `rgba(${bolt.r},${bolt.g},${bolt.b},0.3)`;
          ctx.lineWidth = 6; ctx.lineCap = 'round';
          for (const [x1, y1, x2, y2] of bolt.segs) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
          ctx.strokeStyle = `rgb(${bolt.r},${bolt.g},${bolt.b})`;
          ctx.lineWidth = bolt.life < 3 ? 2.5 : 1;
          for (const [x1, y1, x2, y2] of bolt.segs) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = bolt.life < 2 ? 1.5 : 0.5;
          for (const [x1, y1, x2, y2] of bolt.segs) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
          ctx.strokeStyle = `rgba(${bolt.r},${bolt.g},${bolt.b},0.5)`;
          ctx.lineWidth = 0.8;
          for (const bsegs of bolt.branches) for (const [x1, y1, x2, y2] of bsegs) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
          ctx.restore();
          if (bolt.life < 3) {
            ctx.save(); ctx.globalAlpha = 0.06 * bolt.alpha;
            ctx.fillStyle = `rgb(${bolt.r},${bolt.g},${bolt.b})`; ctx.fillRect(0, 0, w, h);
            ctx.restore();
          }
        }
        if (Math.random() < (isCollected ? 0.03 : 0.012)) {
          const gy = Math.random() * h;
          ctx.fillStyle = `rgba(${glow},${isCollected ? 0.15 : 0.06})`; ctx.fillRect(0, gy, w, Math.random() * 5 + 1);
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [isCollected, effectType, col, glow, alphaScale]);

  return (
    <div
      ref={containerRef}
      className={`aura-card ${!isCollected ? 'aura-locked' : 'aura-unlocked'} ${className}`}
      style={{
        '--accent-border': isCollected ? rarityColor : `${rarityColor}22`,
        '--rarity-glow': isCollected ? rarityColor : 'transparent',
        ...style
      } as React.CSSProperties}
    >
      <canvas ref={canvasRef} style={{ opacity: isCollected ? 1 : 0.7 }} />
      <div className="card-glass" />
      <div className="glitch-bar"></div>
      <div className="scanline"></div>

      {children}

      {!children && !isCollected && (
        <Lock size={13} className="aura-lock-icon" />
      )}

      {!children && <span className="card-rank">{rankLabel}</span>}

      {!children && (
        <div className="card-content">
          <div className="card-label" style={{ paddingBottom: '2px', opacity: isCollected ? 0.8 : 0.35, color: isCollected ? rarityColor : 'inherit' }}>
            {label || effectType}
          </div>
          <span className="card-icon" style={{ opacity: isCollected ? 1 : 0.4 }}>{icon}</span>
          <div className="card-name" style={{ lineHeight: 1.2, opacity: isCollected ? 1 : 0.5 }}>{name}</div>
          <div className="card-sub" style={{ marginTop: '4px', opacity: isCollected ? 0.6 : 0.3 }}>{sub}</div>
        </div>
      )}

      {!children && isCollected && bonus > 0 && (
        <div
          className="bonus-pill"
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'rgba(52, 211, 153, 0.12)', color: '#34d399',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            padding: '3px 8px', borderRadius: '99px',
            fontSize: '0.65rem', fontWeight: 800,
            backdropFilter: 'blur(8px)'
          }}
        >
          +{bonus}% XP
        </div>
      )}
    </div>
  );
}
