import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Zap, Activity, Globe, Skull, Gem, ZoomIn, ZoomOut, Move, Crosshair, BarChart3, Database } from "lucide-react";

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

  const fetchData = async () => {
    if (!supabase) return;
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [profRes, guildRes, activeRes, shadowsRes, topHuntersRes, taskRes] = await Promise.all([
        supabase.from("user_profiles").select("user_id", { count: 'exact', head: true }),
        supabase.from("guilds").select("id", { count: 'exact', head: true }),
        supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("is_active", true),
        supabase.from("shadows").select("id", { count: 'exact', head: true }),
        supabase.from("user_profiles").select("user_id, name, total_points, player_rank, level").order("total_points", { ascending: false }).limit(40),
        supabase.from("tasks").select("user_id").eq("is_completed", true).gt("completed_at", sevenDaysAgo.toISOString())
      ]);

      const { data: allShadows } = await supabase.from("shadows").select("user_id, name, rarity");

      const nodes: HunterNode[] = (topHuntersRes.data || []).map(h => {
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

      setHunters(nodes);
      setStats({
        activeHunters: profRes.count || 0,
        totalGuilds: guildRes.count || 0,
        manaPulse: 72 + Math.floor(Math.random() * 20),
        systemStability: (activeRes.count || 0) > 3 ? "SYSTEM STRAIN" : "OPTIMIZED",
        totalShadows: shadowsRes.count || 0
      });
    } catch (err) {
      console.error("War Room synchronization failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(transform.scale * delta, 0.05), 3);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

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
          <button className="wr-control-btn" onClick={() => setTransform({ x: 0, y: 0, scale: 0.4 })}><Move size={14} /> RECENTER</button>
          <div className="v-divider" />
          <button className="wr-control-btn" onClick={() => setTransform(p => ({ ...p, scale: Math.min(p.scale * 1.2, 3) }))}><ZoomIn size={16} /></button>
          <button className="wr-control-btn" onClick={() => setTransform(p => ({ ...p, scale: Math.max(p.scale * 0.8, 0.05) }))}><ZoomOut size={16} /></button>
        </div>
      </div>

      <div className="war-room-container">
        {/* PREMIUM STATS HUD */}
        <div className="wr-hud-stats">
          <div className="hud-stat-card ds-glass">
            <div className="h-stat-icon-box"><Globe size={18} /></div>
            <div className="h-stat-meta">
              <span className="h-stat-val">{stats.activeHunters}</span>
              <span className="h-stat-label">ACTIVE_HUNTERS</span>
            </div>
            <div className="h-stat-bar"><div className="h-stat-progress" style={{ width: '85%' }} /></div>
          </div>
          <div className="hud-stat-card ds-glass">
            <div className="h-stat-icon-box" style={{ color: 'var(--accent-primary)' }}><Activity size={18} /></div>
            <div className="h-stat-meta">
              <span className="h-stat-val">{stats.systemStability}</span>
              <span className="h-stat-label">SYSTEM_STATUS</span>
            </div>
            <div className="h-stat-bar"><div className="h-stat-progress" style={{ width: '100%', background: 'var(--accent-primary)' }} /></div>
          </div>
          <div className="hud-stat-card ds-glass">
            <div className="h-stat-icon-box"><Zap size={18} /></div>
            <div className="h-stat-meta">
              <span className="h-stat-val">{stats.manaPulse}%</span>
              <span className="h-stat-label">MANA_PULSE</span>
            </div>
            <div className="h-stat-bar"><div className="h-stat-progress" style={{ width: `${stats.manaPulse}%` }} /></div>
          </div>
          <div className="hud-stat-card ds-glass">
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
                <div className="region-stat"><span>SECTOR_ALPHA</span><span className="val">84%</span></div>
                <div className="region-stat"><span>SECTOR_BRAVO</span><span className="val">22%</span></div>
                <div className="region-stat"><span>SECTOR_OMEGA</span><span className="val">91%</span></div>
              </div>
            </div>
            <div className="intel-card ds-glass">
              <div className="intel-header"><Database size={14} /> Mana Archives</div>
              <div className="intel-body">
                <div className="archive-entry">System latency: 14ms</div>
                <div className="archive-entry">Packet resonance: HIGH</div>
                <div className="archive-entry">Auth: MONARCH_LV_99</div>
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
                    return (
                      <div key={h.user_id} className={`vision-node-v7 ${isHighRes ? 'hot-node' : ''}`} style={{ 
                        top: h.y, 
                        left: h.x,
                      }}>
                        {/* HUNTER DIAMOND (Core) */}
                        <div className="tactical-unit hunter-core-node">
                          <Gem size={32} className="unit-icon" fill={isHighRes ? "currentColor" : "none"} />
                          <div className="unit-aura-pulse" />
                          
                          <div className="node-tooltip">
                            <div className="h-name">{h.name}</div>
                            <div className="h-rank">LV.{h.level} {h.player_rank}-RANK</div>
                          </div>
                        </div>
                        
                        {/* SHADOW UNITS (Random Movement & Equal Size) */}
                        {h.shadows.slice(0, 10).map((s, idx) => {
                          const baseAngle = (idx / Math.min(h.shadows.length, 10)) * Math.PI * 2;
                          const dist = 100 + (Math.sin(idx + h.x) * 30); 
                          const bx = Math.cos(baseAngle) * dist;
                          const by = Math.sin(baseAngle) * dist;
                          
                          return (
                            <div 
                              key={idx} 
                              className="tactical-unit shadow-unit-node" 
                              style={{ 
                                transform: `translate(${bx}px, ${by}px)`,
                                animationName: 'randomWanderV2',
                                animationDuration: `${4 + Math.random() * 4}s`,
                                animationDelay: `${-Math.random() * 6}s`
                              }}
                            >
                              {/* Connector Line to Player */}
                              <div className="connector-line" style={{ transform: `rotate(${-baseAngle}rad) scaleX(${dist / 50})` }} />
                              
                              <Skull size={32} className="unit-icon spectral-skull" />
                              <div className="unit-aura-pulse shadow-aura" />
                              <div className="node-tooltip">
                                <div className="h-name">{s.name}</div>
                                <div className="h-rank">{s.rarity} SHADOW</div>
                              </div>
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
                <div className="hud-title">SYSTEM_OVERWATCH_v3.5.0</div>
                <div className="hud-coordinates">LOC_0.0.0.0</div>
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
        .wr-main-layout { display: grid; grid-template-columns: 240px 1fr; gap: 24px; }
        .wr-side-intel { display: flex; flex-direction: column; gap: 24px; }
        .intel-card { padding: 16px; border-radius: var(--r-lg); border: 1px solid rgba(255,255,255,0.05); }
        .intel-header { font-size: 0.65rem; font-weight: 900; color: var(--accent-primary); letter-spacing: 2px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; }
        .region-stat { display: flex; justify-content: space-between; font-size: 0.55rem; font-weight: 800; margin-bottom: 4px; color: var(--t2); }
        .region-stat .val { color: #fff; }
        .archive-entry { font-size: 0.55rem; color: var(--t3); margin-bottom: 4px; font-family: monospace; }

        .wr-hud-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 24px; }
        .hud-stat-card { 
          padding: 24px; border-radius: var(--r-xl); 
          display: flex; align-items: center; gap: 24px; 
          position: relative; overflow: hidden;
          background: rgba(10,10,20,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          backdrop-filter: blur(15px);
          transition: all 0.3s ease;
        }
        .hud-stat-card:hover { 
          transform: translateY(-5px); 
          background: rgba(10,10,20,0.5); 
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 15px 35px rgba(0,0,0,0.4);
        }
        .h-stat-icon-box { width: 56px; height: 56px; border-radius: var(--r-md); background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.08); }
        .h-stat-meta { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .h-stat-val { font-size: 1.6rem; font-weight: 950; color: #fff; line-height: 1; }
        .h-stat-label { font-size: 0.65rem; font-weight: 900; letter-spacing: 2px; opacity: 0.4; }
        .h-stat-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.05); }
        .h-stat-progress { height: 100%; background: #fff; opacity: 0.2; }

        .wr-vision-panel { padding: 0; height: 750px; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--r-2xl); position: relative; border: 1px solid rgba(255,255,255,0.1); }
        .wr-panel-header { padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; z-index: 10; background: rgba(5,5,10,0.85); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.1); }
        .tactical-title { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; font-weight: 950; letter-spacing: 4px; }
        .status-blink { width: 8px; height: 8px; background: #34d399; border-radius: 50%; box-shadow: 0 0 10px #34d399; animation: blink 1.2s infinite; }
        
        .vision-viewport { flex: 1; position: relative; background: #000; cursor: crosshair; overflow: hidden; }
        .vision-viewport:active { cursor: grabbing; }

        .radar-grid { position: absolute; inset: -10000px; }
        .radar-grid.major { background-image: linear-gradient(rgba(168,168,255,0.12) 2px, transparent 2px), linear-gradient(90deg, rgba(168,168,255,0.12) 2px, transparent 2px); }
        .radar-grid.minor { background-image: linear-gradient(rgba(168,168,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(168,168,255,0.05) 1px, transparent 1px); }

        .vision-content-wrapper { position: absolute; top: 50%; left: 50%; width: 0; height: 0; }
        .vision-node-v7 { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; }
        
        .tactical-unit { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; position: relative; transition: 0.3s; z-index: 10; }
        .unit-icon { color: #fff; z-index: 2; transition: 0.3s; }
        .unit-aura-pulse { position: absolute; inset: -2px; border: 2px solid rgba(255,255,255,0.15); border-radius: 50%; animation: auraPulse 3s infinite alternate; }
        
        .shadow-unit-node { z-index: 15; animation: randomWanderV2 8s ease-in-out infinite; }
        .spectral-skull { color: var(--monarch-purple); filter: drop-shadow(0 0 15px var(--monarch-purple)); }
        .shadow-aura { border-color: var(--monarch-purple); opacity: 0.3; }
        
        .connector-line { position: absolute; left: 50%; top: 50%; width: 50px; height: 1px; background: linear-gradient(90deg, rgba(168,168,255,0.1), transparent); transform-origin: left; z-index: 1; pointer-events: none; opacity: 0.5; }

        @keyframes randomWanderV2 {
          0%, 100% { transform: translate(var(--tw-translate-x), var(--tw-translate-y)) translate(0, 0); }
          25% { transform: translate(var(--tw-translate-x), var(--tw-translate-y)) translate(30px, -20px); }
          50% { transform: translate(var(--tw-translate-x), var(--tw-translate-y)) translate(-20px, 40px); }
          75% { transform: translate(var(--tw-translate-x), var(--tw-translate-y)) translate(40px, 30px); }
        }

        .node-tooltip { position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%); background: rgba(5,5,15,0.85); border: 1px solid rgba(168,168,255,0.2); border-top: 3px solid var(--accent-primary); padding: 16px 24px; border-radius: 16px; min-width: 200px; backdrop-filter: blur(25px); opacity: 0; visibility: hidden; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; box-shadow: 0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(168,168,255,0.05); z-index: 100; display: flex; flex-direction: column; gap: 4px; }
        .tactical-unit:hover .node-tooltip { opacity: 1; visibility: visible; bottom: 135%; }
        .h-name { font-size: 1.15rem; font-weight: 950; color: #fff; white-space: nowrap; font-family: 'Outfit', sans-serif; text-shadow: 0 2px 10px rgba(255,255,255,0.2); }
        .h-rank { font-size: 0.65rem; font-weight: 900; color: var(--accent-primary); letter-spacing: 2px; text-transform: uppercase; }

        .hud-overlay-v2 { position: absolute; inset: 0; pointer-events: none; border: 2px solid rgba(168,168,255,0.05); }
        .hud-corner { position: absolute; width: 40px; height: 40px; border: 3px solid var(--accent-primary); opacity: 0.3; }
        .tl { top: 30px; left: 30px; border-right: none; border-bottom: none; }
        .tr { top: 30px; right: 30px; border-left: none; border-bottom: none; }
        .bl { bottom: 30px; left: 30px; border-right: none; border-top: none; }
        .br { bottom: 30px; right: 30px; border-left: none; border-top: none; }
        .hud-scanline { position: absolute; top: 0; left: 0; right: 0; height: 100px; background: linear-gradient(rgba(168,168,255,0.05), transparent); animation: scanV2 6s linear infinite; }
        @keyframes scanV2 { from { top: -100px; } to { top: 100%; } }
        .hud-title { position: absolute; bottom: 32px; left: 32px; font-size: 0.65rem; letter-spacing: 6px; opacity: 0.2; font-weight: 950; color: var(--accent-primary); }

        .wr-panel-footer { padding: 18px 32px; display: flex; justify-content: space-between; background: #000; font-size: 0.6rem; color: var(--t4); letter-spacing: 2px; border-top: 1px solid rgba(255,255,255,0.1); }
        .wr-loader { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 950; color: var(--accent-primary); letter-spacing: 8px; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .wr-controls {
          display: flex; align-items: center; gap: 4px;
          padding: 6px; border-radius: var(--r-lg);
          background: rgba(10,10,20,0.4);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .wr-control-btn {
          background: transparent; border: 1px solid transparent;
          color: var(--t2); font-size: 0.65rem; font-weight: 900;
          padding: 10px 16px; border-radius: var(--r-md);
          display: flex; align-items: center; gap: 10px;
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          letter-spacing: 2px; text-transform: uppercase;
        }
        .wr-control-btn:hover {
          background: rgba(255,255,255,0.07); color: #fff;
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .wr-control-btn:active { transform: translateY(0); }
        .v-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 8px; }
      `}</style>
    </section>
  );
}
