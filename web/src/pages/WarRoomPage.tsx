import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Zap, Activity, Globe, Skull, Gem, ZoomIn, ZoomOut, Move, Crosshair, BarChart3, Database, Crown } from "lucide-react";
import { useAuth } from "../lib/authContext";

type ShadowUnit = { name: string; rarity: string };

type HunterNode = {
  user_id: string;
  name: string;
  level: number;
  total_points: number;
  player_rank: string;
  activity: number;
  shadows: ShadowUnit[];
  heat: number;
  x: number;
  y: number;
};

// Seeded random for consistent but spread out positions
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return {
    x: (Math.sin(hash) * 2500),
    y: (Math.cos(hash * 13) * 1800)
  };
};

export function WarRoomPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeHunters: 0,
    totalGuilds: 0,
    manaPulse: 85,
    systemStability: "Stable",
    totalShadows: 0
  });
  const [hunters, setHunters] = useState<HunterNode[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── INTERACTIVE MAP STATE ── */
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.4 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const [selectedHunter, setSelectedHunter] = useState<HunterNode | null>(null);
  const [regions, setRegions] = useState<{name: string, count: number, density: number}[]>([]);

  const fetchData = async () => {
    if (!supabase || !user) return;
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [profRes, guildRes, activeRes, shadowsRes, topHuntersRes, taskRes, selfRes] = await Promise.all([
        supabase.from("user_profiles").select("user_id", { count: 'exact', head: true }),
        supabase.from("guilds").select("id", { count: 'exact', head: true }),
        supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("is_active", true),
        supabase.from("shadows").select("id", { count: 'exact', head: true }),
        supabase.from("user_profiles").select("user_id, name, total_points, player_rank, level").order("total_points", { ascending: false }).limit(60),
        supabase.from("tasks").select("user_id").eq("is_completed", true).gt("completed_at", sevenDaysAgo.toISOString()),
        supabase.from("user_profiles").select("user_id, name, total_points, player_rank, level").eq("user_id", user.id).single()
      ]);

      const { data: allShadows } = await supabase.from("shadows").select("user_id, name, rarity");

      let hunterData = [...(topHuntersRes.data || [])];
      if (selfRes.data && !hunterData.find(h => h.user_id === user.id)) {
        hunterData.push(selfRes.data);
      }

      const nodes: HunterNode[] = hunterData.map(h => {
        const userShadows = allShadows?.filter(s => s.user_id === h.user_id) || [];
        const recentTasks = taskRes.data?.filter(t => t.user_id === h.user_id).length || 0;
        const pos = seededRandom(h.user_id);
        
        return {
          ...h,
          activity: recentTasks,
          shadows: userShadows.map(s => ({ name: s.name, rarity: s.rarity })),
          heat: (h.total_points / 500) + (recentTasks * 10),
          x: pos.x,
          y: pos.y
        };
      });

      // Calculate Dynamic Regional Density
      const regionalStats = [
        { name: "SECTOR_ALPHA", count: nodes.filter(n => n.x < 0 && n.y < 0).length, density: 0 },
        { name: "SECTOR_BRAVO", count: nodes.filter(n => n.x >= 0 && n.y < 0).length, density: 0 },
        { name: "SECTOR_OMEGA", count: nodes.filter(n => n.y >= 0).length, density: 0 },
      ].map(r => ({ ...r, density: Math.floor((r.count / nodes.length) * 100) }));

      setRegions(regionalStats);
      setHunters(nodes);
      setStats({
        activeHunters: profRes.count || 0,
        totalGuilds: guildRes.count || 0,
        manaPulse: 72 + Math.floor(Math.random() * 20),
        systemStability: (activeRes.count || 0) > 10 ? "SYSTEM STRAIN" : "OPTIMIZED",
        totalShadows: shadowsRes.count || 0
      });
    } catch (err) {
      console.error("War Room synchronization failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (user) fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const recenterOnMe = () => {
    const me = hunters.find(h => h.user_id === user?.id);
    if (me) {
      setTransform({ x: -me.x * 0.4, y: -me.y * 0.4, scale: 0.4 });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Prevent page scroll when zooming the map
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(transform.scale * delta, 0.05), 3);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  /* ── NON-PASSIVE WHEEL LISTENER FOR SCROLL PREVENTION ── */
  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    const preventDefault = (e: WheelEvent) => {
      e.preventDefault();
    };

    mapElement.addEventListener('wheel', preventDefault, { passive: false });
    return () => mapElement.removeEventListener('wheel', preventDefault);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <section className="page war-room-page">
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h2 className="page-title">Monarch's Vision</h2>
          <p className="page-subtitle">Global Tactical Overwatch • System Resonance Map</p>
        </div>
        <div className="wr-controls ds-glass">
          <button className="wr-control-btn locate-btn" onClick={recenterOnMe}><Crosshair size={14} /> LOCATE_SELF</button>
          <div className="v-divider" />
          <button className="wr-control-btn" onClick={() => setTransform({ x: 0, y: 0, scale: 0.4 })}><Move size={14} /> RECENTER</button>
          <div className="v-divider" />
          <div className="zoom-group">
            <button className="wr-control-btn zoom-btn" onClick={() => setTransform(p => ({ ...p, scale: Math.min(p.scale * 1.2, 3) }))}><ZoomIn size={16} /></button>
            <button className="wr-control-btn zoom-btn" onClick={() => setTransform(p => ({ ...p, scale: Math.max(p.scale * 0.8, 0.05) }))}><ZoomOut size={16} /></button>
          </div>
        </div>
      </div>

      <div className="war-room-container">
        {/* PREMIUM STATS HUD */}
        <div className="wr-hud-stats">
          <div className="hud-stat-card ds-glass h-pulse-blue">
            <div className="h-stat-icon-box"><Globe size={18} /></div>
            <div className="h-stat-meta">
              <span className="h-stat-val">{stats.activeHunters}</span>
              <span className="h-stat-label">ACTIVE_HUNTERS</span>
            </div>
            <div className="h-stat-bar"><div className="h-stat-progress" style={{ width: '85%' }} /></div>
          </div>
          <div className="hud-stat-card ds-glass h-pulse-gold">
            <div className="h-stat-icon-box" style={{ color: 'var(--accent-primary)' }}><Activity size={18} /></div>
            <div className="h-stat-meta">
              <span className="h-stat-val" style={{ color: stats.systemStability === 'OPTIMIZED' ? 'var(--accent-primary)' : '#ff4444' }}>{stats.systemStability}</span>
              <span className="h-stat-label">SYSTEM_STATUS</span>
            </div>
            <div className="h-stat-bar"><div className="h-stat-progress" style={{ width: '100%', background: 'var(--accent-primary)' }} /></div>
          </div>
          <div className="hud-stat-card ds-glass h-pulse-purple">
            <div className="h-stat-icon-box" style={{ color: '#a8a8ff' }}><Zap size={18} /></div>
            <div className="h-stat-meta">
              <span className="h-stat-val">{stats.manaPulse}%</span>
              <span className="h-stat-label">MANA_RESONANCE</span>
            </div>
            <div className="h-stat-bar"><div className="h-stat-progress" style={{ width: `${stats.manaPulse}%`, background: '#a8a8ff' }} /></div>
          </div>
          <div className="hud-stat-card ds-glass h-pulse-monarch">
            <div className="h-stat-icon-box" style={{ color: 'var(--monarch-purple)' }}><Skull size={18} /></div>
            <div className="h-stat-meta">
              <span className="h-stat-val">{stats.totalShadows}</span>
              <span className="h-stat-label">ARMY_STRENGTH</span>
            </div>
            <div className="h-stat-bar"><div className="h-stat-progress" style={{ width: '60%', background: 'var(--monarch-purple)' }} /></div>
          </div>
        </div>

        <div className="wr-main-layout">
          {/* SIDE ANALYTICS */}
          <aside className="wr-side-intel">
            <div className="intel-card ds-glass">
              <div className="intel-header"><BarChart3 size={14} /> Regional Density</div>
              <div className="intel-body">
                {regions.map(r => (
                  <div key={r.name} className="region-stat">
                    <span>{r.name}</span>
                    <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.05)', margin: '0 12px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${r.density}%`, background: 'var(--accent-primary)', opacity: 0.4 }} />
                    </div>
                    <span className="val">{r.density}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            {selectedHunter && (
              <div className="intel-card ds-glass selected-intel animate-in-slide">
                <div className="intel-header" style={{ color: 'var(--accent-primary)' }}><Crosshair size={14} /> Target Locked</div>
                <div className="intel-body">
                  <div className="target-name">{selectedHunter.name} {selectedHunter.user_id === user?.id && <span className="self-tag">(YOU)</span>}</div>
                  <div className="target-rank">RANK: {selectedHunter.player_rank} • LV: {selectedHunter.level}</div>
                  
                  <div className="target-shadows-list">
                    <div className="shadow-list-title">EXTRACTED SHADOWS ({selectedHunter.shadows.length})</div>
                    {selectedHunter.shadows.length > 0 ? (
                      <div className="shadow-grid-mini">
                        {selectedHunter.shadows.slice(0, 8).map((s, i) => (
                          <div key={i} className="mini-shadow-icon" title={`${s.name} (${s.rarity})`}>
                            <Skull size={12} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-shadows">NO_SHADOWS_EXTRACTED</div>
                    )}
                  </div>
                  
                  <button className="deselection-btn" onClick={() => setSelectedHunter(null)}>RELEASE_TARGET</button>
                </div>
              </div>
            )}

            <div className="intel-card ds-glass">
              <div className="intel-header"><Database size={14} /> Mana Archives</div>
              <div className="intel-body archive-body">
                <div className="archive-entry">Latency: <span className="archive-val-green">14ms</span></div>
                <div className="archive-entry">Resonance: <span className="archive-val-blue">STABLE</span></div>
                <div className="archive-entry">Protocol: <span className="archive-val-dim">MONARCH_V5</span></div>
              </div>
            </div>
          </aside>

          <article className="wr-vision-panel ds-glass">
            <div className="wr-panel-header">
              <div className="tactical-title">
                <Crosshair size={14} className="animate-spin-slow" />
                <span>LIVE_TACTICAL_OVERWATCH</span>
                <div className="status-blink" />
              </div>
              <div className="wr-coordinates">
                POS_X: {Math.round(transform.x)} • POS_Y: {Math.round(transform.y)} • MAG: {Math.round(transform.scale * 100)}%
              </div>
            </div>

            <div 
              className="vision-viewport" 
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              ref={mapRef}
            >
              {/* RADAR SWEEP ANIMATION */}
              <div className="radar-sweep" />

              {/* MAJOR GRID LINES (Visible) */}
              <div className="radar-grid major" style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                backgroundSize: `${200 / transform.scale}px ${200 / transform.scale}px`
              }} />
              
              {/* MINOR GRID LINES (Subtle) */}
              <div className="radar-grid minor" style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                backgroundSize: `${40 / transform.scale}px ${40 / transform.scale}px`
              }} />
              
              <div className="vision-content-wrapper" style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
              }}>
                {loading ? (
                  <div className="wr-loader">SYNCHRONIZING_TACTICAL_DATA...</div>
                ) : (
                  hunters.map((h) => {
                    const isHighRes = h.heat > 40;
                    const isSelected = selectedHunter?.user_id === h.user_id;
                    const isMe = h.user_id === user?.id;
                    return (
                      <div 
                        key={h.user_id} 
                        className={`vision-node-v7 ${isHighRes ? 'hot-node' : ''} ${isSelected ? 'target-locked' : ''} ${isMe ? 'sovereign-node' : ''}`} 
                        style={{ top: h.y, left: h.x }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHunter(h);
                        }}
                      >
                        {/* HUNTER DIAMOND (Core) */}
                        <div className="tactical-unit hunter-core-node">
                          {isMe ? (
                            <Crown size={42} className="unit-icon sovereign-icon" fill="var(--accent-primary)" />
                          ) : (
                            <Gem size={32} className="unit-icon" fill={isHighRes ? "currentColor" : "none"} />
                          )}
                          <div className="unit-aura-pulse" />
                          
                          <div className="node-tooltip">
                            <div className="h-name">{h.name} {isMe && "(YOU)"}</div>
                            <div className="h-rank">LV.{h.level} {h.player_rank}-RANK</div>
                            <div className="h-shadow-count">{h.shadows.length} SHADOWS</div>
                          </div>
                        </div>
                        
                        {/* SHADOW UNITS (Random Movement) */}
                        {h.shadows.slice(0, 6).map((_, idx) => {
                          const baseAngle = (idx / Math.min(h.shadows.length, 6)) * Math.PI * 2;
                          const dist = 80 + (Math.sin(idx + h.x) * 20); 
                          const bx = Math.cos(baseAngle) * dist;
                          const by = Math.sin(baseAngle) * dist;
                          
                          return (
                            <div 
                              key={idx} 
                              className="tactical-unit shadow-unit-node" 
                              style={{ 
                                transform: `translate(${bx}px, ${by}px)`,
                                animationDelay: `${idx * 0.2}s`
                              }}
                            >
                              <Skull size={20} className="unit-icon spectral-skull" />
                              <div className="unit-aura-pulse shadow-aura" />
                              
                              {/* CONNECTOR LINE */}
                              <div className="connector-line" style={{ 
                                width: dist,
                                transform: `rotate(${baseAngle + Math.PI}rad)`
                              }} />
                            </div>
                          );
                        })}
                        
                        {isHighRes && <div className="resonance-field" />}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hud-overlay-v2">
                <div className="hud-corner tl" /><div className="hud-corner tr" />
                <div className="hud-corner bl" /><div className="hud-corner br" />
                <div className="hud-scanline" />
                <div className="hud-title">SYSTEM_OVERWATCH_v5.0.0</div>
                <div className="hud-coordinates">X_{Math.round(transform.x / 10)} Y_{Math.round(transform.y / 10)}</div>
              </div>
            </div>

            <div className="wr-panel-footer">
              <div className="f-left">ANALYZING_WORLD_MANA_DENSITY... [OK]</div>
              <div className="f-right">SYSTEM_TIME: {new Date().toLocaleTimeString()}</div>
            </div>
          </article>
        </div>
      </div>

      <style>{`
        .wr-main-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; }
        .wr-side-intel { display: flex; flex-direction: column; gap: 20px; }
        .intel-card { padding: 24px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.06); background: rgba(10,10,20,0.4); backdrop-filter: blur(20px); }
        .intel-header { font-size: 0.7rem; font-weight: 900; color: var(--accent-primary); letter-spacing: 3px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; text-transform: uppercase; }
        
        .region-stat { display: flex; align-items: center; justify-content: space-between; font-size: 0.6rem; font-weight: 800; margin-bottom: 12px; color: var(--t2); }
        .region-stat .val { color: #fff; font-family: monospace; width: 40px; text-align: right; font-size: 0.7rem; }

        .selected-intel { border-color: rgba(168,168,255,0.25); background: rgba(168,168,255,0.05); box-shadow: 0 0 30px rgba(168,168,255,0.1); }
        .target-name { font-size: 1.4rem; font-weight: 950; color: #fff; margin-bottom: 4px; letter-spacing: -0.5px; }
        .target-rank { font-size: 0.7rem; font-weight: 900; color: var(--accent-primary); letter-spacing: 1.5px; margin-bottom: 20px; opacity: 0.9; }
        .self-tag { font-size: 0.6rem; color: var(--accent-primary); background: rgba(168,168,255,0.1); padding: 2px 8px; border-radius: 4px; margin-left: 8px; vertical-align: middle; }

        .wr-hud-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 32px; }
        .hud-stat-card { 
          padding: 28px; border-radius: 28px; 
          display: flex; align-items: center; gap: 20px; 
          position: relative; overflow: hidden;
          background: rgba(15,15,25,0.4);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(25px);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .hud-stat-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,0.15); background: rgba(20,20,35,0.6); }
        .h-stat-icon-box { width: 64px; height: 64px; border-radius: 20px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .h-stat-meta { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .h-stat-val { font-size: 1.8rem; font-weight: 950; color: #fff; line-height: 1.1; letter-spacing: -1px; }
        .h-stat-label { font-size: 0.6rem; font-weight: 900; letter-spacing: 2px; opacity: 0.35; text-transform: uppercase; margin-top: 2px; }
        
        .h-pulse-blue::after { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 40px rgba(59,130,246,0.15); pointer-events: none; animation: innerPulse 4s infinite; }
        .h-pulse-gold::after { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 40px rgba(251,191,36,0.15); pointer-events: none; animation: innerPulse 4s infinite 1s; }
        .h-pulse-purple::after { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 40px rgba(168,168,255,0.15); pointer-events: none; animation: innerPulse 4s infinite 2s; }
        .h-pulse-monarch::after { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 40px rgba(139,92,246,0.15); pointer-events: none; animation: innerPulse 4s infinite 3s; }
        
        @keyframes innerPulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.6; } }

        .wr-vision-panel { padding: 0; height: 800px; display: flex; flex-direction: column; overflow: hidden; border-radius: 36px; position: relative; border: 1px solid rgba(255,255,255,0.12); background: #000; box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
        .wr-panel-header { padding: 24px 36px; display: flex; justify-content: space-between; align-items: center; z-index: 10; background: rgba(5,5,10,0.9); backdrop-filter: blur(25px); border-bottom: 1px solid rgba(255,255,255,0.12); }
        .tactical-title { display: flex; align-items: center; gap: 14px; font-size: 0.9rem; font-weight: 950; letter-spacing: 5px; color: var(--accent-primary); }
        .status-blink { width: 10px; height: 10px; background: #34d399; border-radius: 50%; box-shadow: 0 0 15px #34d399; animation: blink 1.2s infinite; }
        .wr-coordinates { font-size: 0.7rem; font-weight: 900; color: rgba(255,255,255,0.3); font-family: monospace; letter-spacing: 1px; }
        
        .vision-viewport { flex: 1; position: relative; background: radial-gradient(circle at center, #0a0a18 0%, #000 100%); cursor: crosshair; overflow: hidden; }
        .radar-sweep { position: absolute; top: 50%; left: 50%; width: 2500px; height: 2500px; background: conic-gradient(from 0deg, rgba(168,168,255,0.18) 0deg, transparent 90deg); transform-origin: top left; animation: sweep 8s linear infinite; pointer-events: none; z-index: 5; opacity: 0.6; }
        @keyframes sweep { from { transform: rotate(0deg) translate(-50%, -50%); } to { transform: rotate(360deg) translate(-50%, -50%); } }

        .radar-grid { position: absolute; inset: -10000px; pointer-events: none; }
        .radar-grid.major { background-image: linear-gradient(rgba(168,168,255,0.1) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(168,168,255,0.1) 1.5px, transparent 1.5px); }
        .radar-grid.minor { background-image: linear-gradient(rgba(168,168,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(168,168,255,0.04) 1px, transparent 1px); }

        .vision-content-wrapper { position: absolute; top: 50%; left: 50%; width: 0; height: 0; }
        .vision-node-v7 { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer; }
        .vision-node-v7:hover { z-index: 200; transform: translate(-50%, -50%) scale(1.15); }
        .target-locked { z-index: 250 !important; }
        .target-locked::before { content: ''; position: absolute; inset: -120px; border: 2px dashed rgba(168,168,255,0.3); border-radius: 50%; animation: spin 12s linear infinite; }

        .sovereign-node { z-index: 300 !important; }
        .sovereign-node .unit-aura-pulse { border-color: var(--accent-primary); border-width: 3px; box-shadow: 0 0 30px var(--accent-primary); }
        .sovereign-icon { filter: drop-shadow(0 0 20px var(--accent-primary)); animation: sovereignFloat 4s ease-in-out infinite; }
        @keyframes sovereignFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

        .tactical-unit { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; position: relative; z-index: 10; }
        .unit-icon { color: #fff; z-index: 2; transition: 0.3s; filter: drop-shadow(0 0 10px rgba(255,255,255,0.4)); }
        .unit-aura-pulse { position: absolute; inset: -8px; border: 2px solid rgba(168,168,255,0.25); border-radius: 50%; animation: auraPulse 3s infinite alternate; }
        
        .shadow-unit-node { z-index: 15; }
        .spectral-skull { color: var(--monarch-purple); filter: drop-shadow(0 0 12px var(--monarch-purple)); }
        .shadow-aura { border-color: var(--monarch-purple); opacity: 0.3; }
        
        .connector-line { position: absolute; left: 50%; top: 50%; height: 1px; background: linear-gradient(90deg, rgba(168,168,255,0.15), transparent); transform-origin: left; z-index: 1; pointer-events: none; opacity: 0.6; }

        .node-tooltip { position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%); background: rgba(5,5,15,0.92); border: 1px solid rgba(168,168,255,0.3); border-top: 4px solid var(--accent-primary); padding: 18px 24px; border-radius: 20px; min-width: 220px; backdrop-filter: blur(30px); opacity: 0; visibility: hidden; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; box-shadow: 0 25px 60px rgba(0,0,0,0.9); z-index: 100; }
        .vision-node-v7:hover .node-tooltip { opacity: 1; visibility: visible; bottom: 140%; }
        .h-name { font-size: 1.25rem; font-weight: 950; color: #fff; white-space: nowrap; font-family: 'Outfit', sans-serif; letter-spacing: -0.5px; }
        .h-rank { font-size: 0.65rem; font-weight: 900; color: var(--accent-primary); letter-spacing: 2px; margin-bottom: 4px; }
        .h-shadow-count { font-size: 0.55rem; color: var(--monarch-purple); font-weight: 900; letter-spacing: 1px; }

        .resonance-field { position: absolute; inset: -80px; border-radius: 50%; background: radial-gradient(circle, rgba(168,168,255,0.05) 0%, transparent 70%); animation: fieldPulse 4s infinite; }
        @keyframes fieldPulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.2); opacity: 0.6; } }

        .hud-scanline { position: absolute; top: 0; left: 0; right: 0; height: 100%; background: linear-gradient(rgba(168,168,255,0.02) 50%, transparent 50%); background-size: 100% 4px; pointer-events: none; opacity: 0.5; }

        @keyframes auraPulse { from { transform: scale(0.95); opacity: 0.3; } to { transform: scale(1.1); opacity: 0.7; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-in-slide { animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }

        /* ── NEW CONTROLS & ARCHIVE STYLES ── */
        .wr-controls { display: flex; align-items: center; padding: 6px 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); gap: 10px; background: rgba(10,10,20,0.8); }
        .wr-control-btn { 
          display: flex; align-items: center; gap: 8px; padding: 10px 16px; 
          border-radius: 12px; border: 1px solid transparent; background: transparent;
          color: rgba(255,255,255,0.7); font-size: 0.75rem; font-weight: 800; 
          letter-spacing: 1px; cursor: pointer; transition: 0.3s;
          white-space: nowrap;
        }
        .wr-control-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }
        .locate-btn { color: var(--accent-primary); border-color: rgba(168,168,255,0.2); }
        .locate-btn:hover { border-color: var(--accent-primary); background: rgba(168,168,255,0.1); }
        
        .zoom-group { display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 2px; }
        .zoom-btn { padding: 8px; gap: 0; min-width: 40px; justify-content: center; }
        
        .v-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.1); }

        .archive-body { display: flex; flex-direction: column; gap: 14px; }
        .archive-entry { font-size: 0.85rem; font-weight: 800; color: rgba(255,255,255,0.4); display: flex; justify-content: space-between; }
        .archive-val-green { color: #34d399; }
        .archive-val-blue { color: var(--accent-primary); }
        .archive-val-dim { color: rgba(255,255,255,0.2); }

        .deselection-btn { 
          width: 100%; margin-top: 24px; padding: 14px; 
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 14px; color: rgba(255,255,255,0.5); font-size: 0.7rem; 
          font-weight: 950; letter-spacing: 2px; cursor: pointer; transition: 0.3s;
        }
        .deselection-btn:hover { background: rgba(255,68,68,0.08); color: #ff4444; border-color: rgba(255,68,68,0.2); }

        .shadow-list-title { font-size: 0.65rem; font-weight: 900; color: rgba(255,255,255,0.2); letter-spacing: 1.5px; margin-bottom: 12px; text-transform: uppercase; }
        .shadow-grid-mini { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .mini-shadow-icon { 
          width: 38px; height: 38px; border-radius: 10px; 
          background: rgba(168,168,255,0.05); border: 1px solid rgba(168,168,255,0.1); 
          display: flex; align-items: center; justify-content: center; color: var(--monarch-purple); 
          transition: 0.3s;
        }
        .mini-shadow-icon:hover { transform: scale(1.1); background: rgba(168,168,255,0.15); border-color: var(--monarch-purple); }
        .no-shadows { font-size: 0.7rem; color: rgba(255,255,255,0.15); font-style: italic; letter-spacing: 1px; }
      `}</style>
    </section>
  );
}
