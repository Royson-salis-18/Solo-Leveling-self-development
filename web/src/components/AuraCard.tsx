import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Skull } from 'lucide-react';

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

  sub?: React.ReactNode;
  bonus?: number;
  label?: string;
  className?: string;
  isCorrupted?: boolean;
  interactive?: boolean;
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
  isCorrupted = false,
  interactive = true,
  style,
  children
}: AuraCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 10, y: -16, z: 1 });
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  // Always-on particles — locked = dim, unlocked = vivid
  const alphaScale = isCollected ? 1.0 : 0.75;
  const soloFrontId = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const qrPattern = useMemo(() => [1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1], []);
  const barcodePattern = useMemo(() => 'tssttststtssttssttstsststtsstts'.split(''), []);

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
    const isCorrupt = isCorrupted;

    const CORRUPT_COL = [[255, 0, 0], [150, 0, 0], [100, 0, 0]];
    const activeCol = isCorrupt ? CORRUPT_COL : col;

    /* ── EFFECT HELPERS ── */
    let pts: any[] = [];
    let tendrils: any[] = [];
    let bolts: any[] = [];
    let orbs: any[] = [];
    let t = 0;

    const spawnFlame = (init: boolean) => {
      const c = activeCol[Math.floor(Math.random() * activeCol.length)];
      pts.push({
        x: w * 0.1 + Math.random() * w * 0.8,
        y: init ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 2.5, // High intensity fire velocity
        vy: -(Math.random() * 4.5 + 1.5), // Faster rise for "awesome" look
        sz: Math.random() * 14 + 6, // Larger fire particles
        a: 0, mA: (Math.random() * 0.8 + 0.3) * alphaScale,
        life: 0, mL: Math.random() * 60 + 30, // Shorter life for aggressive flicker
        wb: Math.random() * Math.PI * 2, c
      });
    };

    const spawnShadow = (init: boolean) => {
      const c = activeCol[Math.floor(Math.random() * activeCol.length)];
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
      const c = activeCol[Math.floor(Math.random() * activeCol.length)];
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
      const [r, g, b] = activeCol[Math.floor(Math.random() * activeCol.length)];
      bolts.push({ segs, branches, alpha: 1 * alphaScale, life: 0, maxLife: 14, r, g, b });
    };

    const spawnOrb = () => {
      const [r, g, b] = activeCol[0];
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

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const updateCompact = () => {
      const rect = el.getBoundingClientRect();
      setIsCompact(rect.width < 260 || rect.height < 280);
    };
    updateCompact();
    const observer = new ResizeObserver(updateCompact);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (children || !isCollected || !containerRef.current || isCompact) return;
    if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -16;
    const ry = ((event.clientX - rect.left) / rect.width - 0.5) * 16;
    setTilt({ x: rx, y: ry, z: 1 });
  };

  const resetTilt = () => {
    if (children) return;
    setTilt({ x: 10, y: -16, z: 1 });
  };

  return (
    <div
      ref={containerRef}
      className={`aura-card ${!isCollected ? 'aura-locked' : 'aura-unlocked'} ${className}`}
      onMouseMove={interactive ? handlePointerMove : undefined}
      onMouseLeave={interactive ? resetTilt : undefined}
      onDoubleClick={interactive ? (() => !children && !isCompact && setIsFlipped((prev) => !prev)) : undefined}
      style={{
        '--accent-border': isCollected ? rarityColor : `${rarityColor}22`,
        '--rarity-glow': isCollected ? rarityColor : 'transparent',
        transform: !interactive || children || isCompact ? undefined : `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(1.2deg) scale(${tilt.z})`,
        ...style
      } as React.CSSProperties}
    >
      <canvas ref={canvasRef} style={{ opacity: isCollected ? 1 : 0.7 }} />
      <div className="card-glass" />
      <div className="glitch-bar"></div>
      <div className="scanline"></div>
      {isCorrupted && (
        <div 
          className="corruption-overlay"
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(69, 10, 10, 0.2)',
            border: '2px solid rgba(220, 38, 38, 0.5)',
            borderRadius: '12px',
            pointerEvents: 'none',
            zIndex: 10,
            animation: 'corruptionPulse 2s infinite'
          }}
        />
      )}

      <Skull 
        size={70} 
        style={{ 
          position: 'absolute', top: -15, right: -15, 
          opacity: isCollected ? 0.08 : 0.03, 
          color: isCollected ? rarityColor : '#fff',
          transform: 'rotate(15deg)',
          pointerEvents: 'none',
          zIndex: 1
        }} 
      />

      {children}

      {!children && !isCollected && (
        <Lock size={13} className="aura-lock-icon" />
      )}

      {!children && !isCompact && (
        <div className={`solo-card-inner ${isFlipped ? 'solo-card-flipped' : ''}`}>
          <div className="solo-card-face solo-card-front">
            <div className="solo-layers">
              <div className="solo-l-tint" />
              <div className="solo-l-grid" />
              <div className="solo-l-iridescent" />
              <div className="solo-l-vignette" />
              <div className="solo-l-shimmer" />
              <div className="solo-l-toprim" />
              <div className="solo-l-botrim" />
              <div className="solo-l-leftrim" />
            </div>

            <div className="solo-card-content">
              <div className="solo-col-left">
                <Skull size={16} className="solo-skull" />
                <div className="solo-qr-block">
                  {qrPattern.map((on, idx) => (
                    <div key={`${soloFrontId}-qr-${idx}`} className={`solo-qr-cell ${on ? 'on' : ''}`} />
                  ))}
                </div>
                <div className="solo-card-number">{name.slice(0, 3).toUpperCase()}</div>
                <div className="solo-rank-badge">{rankLabel}</div>
              </div>

              <div className="solo-col-right">
                <div className="solo-card-label" style={{ color: isCollected ? rarityColor : 'rgba(255,255,255,0.35)' }}>
                  {label || effectType}
                </div>
                <span className="solo-card-icon" style={{ opacity: isCollected ? 1 : 0.4 }}>
                  {icon}
                </span>
                <div className="solo-card-name" style={{ opacity: isCollected ? 1 : 0.6 }}>{name}</div>
                <div className="solo-card-sub" style={{ opacity: isCollected ? 0.7 : 0.4 }}>{sub}</div>
              </div>
            </div>

            <div className="solo-barcode-strip">
              {barcodePattern.map((kind, idx) => (
                <div key={`${soloFrontId}-bar-${idx}`} className={`solo-bar ${kind === 't' ? 't' : kind === 's' ? 's' : ''}`} />
              ))}
            </div>
            <div className="solo-barcode-txt">SL-SYSTEM-{rankLabel.replace(/\s+/g, '-').toUpperCase()}</div>
          </div>

          <div className="solo-card-face solo-card-back">
            <div className="solo-back-grid" />
            <div className="solo-back-logo">HUNTER</div>
            <div className="solo-back-stripe" />
            <div className="solo-back-sub">SYSTEM - AUTHENTICATED</div>
          </div>
        </div>
      )}

      {!children && isCompact && (
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

      {isCorrupted && (
        <div
          className="corruption-badge"
          style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 10,
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '3px 8px', borderRadius: '4px',
            fontSize: '0.6rem', fontWeight: 900,
            backdropFilter: 'blur(8px)',
            letterSpacing: '2px',
            animation: 'corruptionFlicker 0.2s infinite'
          }}
        >
          <Skull size={10} /> CORRUPTED
        </div>
      )}

      <style>{`
        .solo-card-inner {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          transition: transform 0.75s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 6;
        }
        .solo-card-flipped {
          transform: rotateY(180deg);
        }
        .solo-card-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: inherit;
          overflow: hidden;
        }
        .solo-card-front {
          background: rgba(14, 9, 38, 0.38);
          border: 1px solid rgba(167, 139, 250, 0.28);
          box-shadow:
            0 0 0 1px rgba(124, 58, 237, 0.12),
            0 8px 36px rgba(91, 33, 182, 0.45),
            0 22px 68px rgba(29, 78, 216, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            inset 0 -1px 0 rgba(167, 139, 250, 0.08);
        }
        .solo-card-back {
          transform: rotateY(180deg);
          background: rgba(9, 5, 26, 0.52);
          border: 1px solid rgba(124, 58, 237, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 14px;
        }
        .solo-layers { position: absolute; inset: 0; pointer-events: none; }
        .solo-l-tint { position: absolute; inset: 0; background: linear-gradient(130deg, rgba(91,33,182,0.07) 0%, transparent 42%, rgba(29,78,216,0.2) 65%, rgba(124,58,237,0.3) 80%, rgba(6,182,212,0.12) 100%); }
        .solo-l-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(167,139,250,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.1) 1px, transparent 1px); background-size: 16px 16px; mask-image: linear-gradient(to right, black 0%, transparent 52%); -webkit-mask-image: linear-gradient(to right, black 0%, transparent 52%); }
        .solo-l-iridescent { position: absolute; inset: 0; mix-blend-mode: screen; background: linear-gradient(125deg, transparent 40%, rgba(124,58,237,0.28) 52%, rgba(59,130,246,0.32) 65%, rgba(6,182,212,0.18) 78%, rgba(124,58,237,0.12) 90%); }
        .solo-l-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse 90% 80% at 66% 50%, rgba(124,58,237,0.14) 0%, transparent 68%); }
        .solo-l-shimmer { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 0%, transparent 26%, rgba(255,255,255,0.025) 38%, rgba(167,139,250,0.2) 50%, rgba(59,130,246,0.09) 56%, rgba(255,255,255,0.025) 62%, transparent 74%, transparent 100%); animation: soloShimmer 5.5s ease-in-out infinite; }
        .solo-l-toprim, .solo-l-botrim, .solo-l-leftrim { position: absolute; }
        .solo-l-toprim { top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(to right, transparent, rgba(167,139,250,0.75) 30%, rgba(6,182,212,0.5) 70%, transparent); }
        .solo-l-botrim { bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(to right, transparent, rgba(91,33,182,0.5) 50%, transparent); }
        .solo-l-leftrim { top: 0; bottom: 0; left: 0; width: 1px; background: linear-gradient(to bottom, transparent, rgba(167,139,250,0.35) 50%, transparent); }
        .solo-card-content {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: 90px 1fr;
          padding: 16px 16px 32px;
          z-index: 2;
        }
        .solo-col-left { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .solo-skull { color: rgba(196,181,253,0.75); }
        .solo-qr-block { display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: repeat(6, 1fr); gap: 1.5px; width: 46px; height: 46px; }
        .solo-qr-cell { border-radius: 1px; background: rgba(167,139,250,0.1); }
        .solo-qr-cell.on { background: rgba(196,181,253,0.78); }
        .solo-card-number { font-size: 12px; font-weight: 800; color: rgba(233,213,255,0.92); letter-spacing: 2px; }
        .solo-rank-badge { font-size: 8px; color: rgba(103, 232, 249, 0.9); letter-spacing: 1.4px; text-transform: uppercase; }
        .solo-col-right { display: flex; flex-direction: column; justify-content: center; }
        .solo-card-label { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; font-weight: 800; margin-bottom: 8px; }
        .solo-card-icon { font-size: 24px; display: block; margin-bottom: 10px; }
        .solo-card-name { font-size: 15px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 4px; }
        .solo-card-sub { font-size: 10px; color: rgba(255,255,255,0.6); line-height: 1.4; }
        .solo-barcode-strip { position: absolute; bottom: 12px; left: 14px; right: 14px; height: 10px; display: flex; align-items: center; gap: 1px; z-index: 2; }
        .solo-bar { flex: 1; height: 100%; background: rgba(167,139,250,0.32); border-radius: 0.5px; }
        .solo-bar.t { height: 130%; background: rgba(167,139,250,0.65); }
        .solo-bar.s { height: 65%; background: rgba(167,139,250,0.18); }
        .solo-barcode-txt { position: absolute; bottom: 2px; right: 14px; font-size: 6px; color: rgba(100,88,148,0.65); letter-spacing: 1.2px; z-index: 3; }
        .solo-back-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(167,139,250,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.07) 1px, transparent 1px); background-size: 20px 20px; }
        .solo-back-logo { font-size: 20px; font-weight: 900; color: rgba(196,181,253,0.55); letter-spacing: 7px; text-shadow: 0 0 24px rgba(124,58,237,0.7); z-index: 1; }
        .solo-back-stripe { width: 78%; height: 28px; background: linear-gradient(to right, rgba(91,33,182,0.45), rgba(29,78,216,0.55), rgba(6,182,212,0.3)); border-radius: 5px; z-index: 1; box-shadow: 0 0 22px rgba(91,33,182,0.45); }
        .solo-back-sub { font-size: 8px; color: rgba(167,139,250,0.38); letter-spacing: 2px; z-index: 1; text-transform: uppercase; }

        @keyframes soloShimmer {
          0% { transform: translateX(-90%) skewX(-12deg); opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translateX(190%) skewX(-12deg); opacity: 0; }
        }
        @keyframes corruptionFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes corruptionPulse {
          0%, 100% { opacity: 0.6; box-shadow: 0 0 10px rgba(220,38,38,0.2); }
          50% { opacity: 1; box-shadow: 0 0 25px rgba(220,38,38,0.5); }
        }
      `}</style>
    </div>
  );
}
