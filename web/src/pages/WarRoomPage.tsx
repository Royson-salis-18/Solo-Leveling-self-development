import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Target, Shield, Zap, Activity, Globe } from "lucide-react";

export function WarRoomPage() {
  const [stats, setStats] = useState({
    activeHunters: 0,
    totalGuilds: 0,
    manaPulse: 85,
    systemStability: "Stable",
    totalShadows: 0
  });

  const fetchData = async () => {
    if (!supabase) return;
    
    try {
      const [profRes, guildRes, activeRes, shadowsRes] = await Promise.all([
        supabase.from("user_profiles").select("user_id", { count: 'exact', head: true }),
        supabase.from("guilds").select("id", { count: 'exact', head: true }),
        supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("is_active", true),
        supabase.from("shadows").select("id", { count: 'exact', head: true })
      ]);

      setStats({
        activeHunters: profRes.count || 0,
        totalGuilds: guildRes.count || 0,
        manaPulse: 72 + Math.floor(Math.random() * 20),
        systemStability: (activeRes.count || 0) > 3 ? "SYSTEM STRAIN" : "OPTIMIZED",
        totalShadows: shadowsRes.count || 0
      });
    } catch (err) {
      console.error("War Room synchronization failed:", err);
    }
  };

  useEffect(() => { 
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="page war-room-page">
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0, fontSize: '2.2rem' }}>Monarch's War Room</h2>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', letterSpacing: '0.25em', opacity: 0.6, textTransform: 'uppercase', fontWeight: 800 }}>Strategic Command • System Level Oversight</p>
        </div>
      </div>

      <div className="war-room-container">
        {/* ── CORE STATS ── */}
        <div className="stats-row">
          <div className="wr-stat ds-glass">
            <Globe size={16} className="wr-stat-icon" />
            <div className="wr-stat-content">
              <span className="wr-stat-lbl">Active Hunters</span>
              <span className="wr-stat-val">{stats.activeHunters}</span>
            </div>
          </div>
          <div className="wr-stat ds-glass">
            <Shield size={16} className="wr-stat-icon" />
            <div className="wr-stat-content">
              <span className="wr-stat-lbl">Guild Count</span>
              <span className="wr-stat-val">{stats.totalGuilds}</span>
            </div>
          </div>
          <div className="wr-stat ds-glass">
            <Activity size={16} className="wr-stat-icon" />
            <div className="wr-stat-content">
              <span className="wr-stat-lbl">Shadow Army</span>
              <span className="wr-stat-val" style={{ color: "var(--monarch-purple)" }}>{stats.totalShadows}</span>
            </div>
          </div>
          <div className="wr-stat ds-glass">
            <Zap size={16} className="wr-stat-icon" />
            <div className="wr-stat-content">
              <span className="wr-stat-lbl">Stability</span>
              <span className="wr-stat-val" style={{ color: stats.systemStability === "OPTIMIZED" ? "var(--accent-primary)" : "#ff4d4d" }}>{stats.systemStability}</span>
            </div>
          </div>
        </div>

        {/* ── MONARCH'S VISION (RADAR) ── */}
        <article className="panel ds-glass wr-vision-panel">
          <div className="hex-bg-pattern" />
          <div className="wr-panel-header">
            <h3 className="section-title-alt"><Target size={14} /> Monarch's Vision: Global Resonance</h3>
            <div className="wr-coordinates">LAT: 37.5665° N • LON: 126.9780° E</div>
          </div>

          <div className="vision-hologram">
            <div className="radar-grid" />
            <div className="radar-sweep" />
            <div className="vision-content">
              <div className="glitch-title" data-text="SYSTEM_OVERWATCH">SYSTEM_OVERWATCH</div>
              {[...Array(16)].map((_, i) => (
                <div key={i} className="vision-node" style={{ 
                  top: `${15 + Math.random()*70}%`, 
                  left: `${10 + Math.random()*80}%`, 
                  animationDelay: `${Math.random()*4}s`,
                  borderColor: Math.random() > 0.7 ? "var(--accent-primary)" : "rgba(255,255,255,0.15)"
                }}>
                  <div className="node-pulse" />
                  <div className="node-label">G_{Math.floor(Math.random()*999)}</div>
                </div>
              ))}
            </div>
            <div className="hologram-footer">
              <div className="h-scan">SCANNING_FREQUENCIES...</div>
              <div className="h-auth">AUTH_LEVEL: MONARCH</div>
            </div>
          </div>
        </article>
      </div>

      <style>{`
        .war-room-container { display: flex; flex-direction: column; gap: 24px; }
        
        /* STATS */
        .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .wr-stat { 
          padding: 16px; border-radius: 16px; display: flex; align-items: center; gap: 12px; 
          position: relative; overflow: hidden; min-height: 80px;
        }
        .wr-stat-icon { color: var(--accent-primary); opacity: 0.6; flex-shrink: 0; }
        .wr-stat-content { display: flex; flex-direction: column; overflow: hidden; }
        .wr-stat-lbl { font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.4; margin-bottom: 2px; white-space: nowrap; }
        .wr-stat-val { font-size: 1.25rem; font-weight: 900; line-height: 1.1; font-family: 'Outfit', sans-serif; overflow: hidden; text-overflow: ellipsis; }

        /* VISION PANEL */
        .wr-vision-panel { padding: 24px; position: relative; height: 620px; display: flex; flex-direction: column; overflow: hidden; }
        .wr-panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: relative; z-index: 2; }
        .wr-coordinates { font-size: 0.5rem; font-family: monospace; color: var(--accent-primary); opacity: 0.4; letter-spacing: 1px; }
        
        .vision-hologram {
          flex: 1; background: rgba(0,0,0,0.3); border-radius: 16px; border: 1px solid rgba(168,168,255,0.08);
          position: relative; overflow: hidden; display: flex; flex-direction: column;
        }
        .radar-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(168,168,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(168,168,255,0.03) 1px, transparent 1px);
          background-size: 30px 30px;
        }
        .radar-sweep {
          position: absolute; inset: -100%;
          background: conic-gradient(from 0deg, transparent 0deg, rgba(168,168,255,0.08) 60deg, transparent 61deg);
          animation: sweep 8s linear infinite; transform-origin: center;
        }
        @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .glitch-title {
          position: absolute; top: 16px; left: 16px; font-size: 0.55rem; font-weight: 900; letter-spacing: 3px; color: var(--accent-primary); opacity: 0.7;
        }
        .vision-node {
          position: absolute; width: 6px; height: 6px; border: 1px solid #fff; transform: rotate(45deg);
          animation: nodeFlash 3s infinite;
        }
        .node-pulse {
          position: absolute; inset: -8px; border-radius: 50%; border: 1px solid var(--accent-primary);
          animation: nodePulse 3s infinite; opacity: 0;
        }
        @keyframes nodePulse { 0% { transform: scale(0.5); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes nodeFlash { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
        .node-label {
          position: absolute; top: 10px; left: 10px; transform: rotate(-45deg);
          font-size: 0.45rem; font-family: monospace; opacity: 0.4; white-space: nowrap;
        }

        .hologram-footer {
          position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 16px;
          display: flex; justify-content: space-between; background: rgba(0,0,0,0.5);
          border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.5rem; font-family: monospace; opacity: 0.5;
        }

        .hex-bg-pattern {
          position: absolute; inset: 0; opacity: 0.02; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill-rule='evenodd' stroke='%23fff' fill='none'/%3E%3C/svg%3E");
          background-size: 40px 40px;
        }
      `}</style>
    </section>
  );
}
