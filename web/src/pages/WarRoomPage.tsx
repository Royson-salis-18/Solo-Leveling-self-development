import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Target, Shield, Swords, Zap, Activity, Users, Globe, ChevronRight } from "lucide-react";
import { Button } from "../components/Button";

type ActivityItem = {
  id: string;
  user_name: string;
  action: string;
  details: string;
  timestamp: string;
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
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    
    try {
      const [profRes, guildRes, taskRes, activeRes, shadowsRes] = await Promise.all([
        supabase.from("user_profiles").select("user_id", { count: 'exact', head: true }),
        supabase.from("guilds").select("id", { count: 'exact', head: true }),
        supabase.from("tasks").select(`
          id, title, is_completed, is_active, is_pending, is_failed,
          created_at, completed_at,
          user_profiles!tasks_user_id_fkey ( name )
        `).order("created_at", { ascending: false }).limit(10),
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

      if (taskRes.data) {
        const mapped: ActivityItem[] = taskRes.data.map((t: any) => {
          let action = "MANIFESTED QUEST";
          let time = t.created_at;
          if (t.is_completed) {
            action = "GATE CONQUERED";
            time = t.completed_at || t.created_at;
          } else if (t.is_active) {
            action = "RAID INITIATED";
          } else if (t.is_failed) {
            action = "MISSION FAILED";
          } else if (t.is_pending) {
            action = "EVALUATION PENDING";
          }
          
          return {
            id: t.id,
            user_name: t.user_profiles?.name || "Unknown Hunter",
            action,
            details: t.title,
            timestamp: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        });
        setActivities(mapped);
      }
    } catch (err) {
      console.error("War Room synchronization failed:", err);
    }
    
    setLoading(false);
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

      <div className="war-room-grid">
        {/* ── LEFT: GLOBAL OVERVIEW ── */}
        <div className="war-room-left">
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
                   {[...Array(12)].map((_, i) => (
                     <div key={i} className="vision-node" style={{ 
                        top: `${20 + Math.random()*60}%`, 
                        left: `${15 + Math.random()*70}%`, 
                        animationDelay: `${Math.random()*3}s`,
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

        {/* ── RIGHT: LIVE FEED ── */}
        <div className="war-room-right">
           <article className="panel ds-glass wr-feed-panel">
              <div className="wr-feed-header">
                <h3 className="section-title-alt"><Activity size={14} /> Neural Stream</h3>
                <span className="live-indicator"><span className="live-dot" /> LIVE</span>
              </div>
              
              <div className="activity-stream">
                 {activities.length === 0 ? (
                   <div className="text-muted text-center py-20">Awaiting system manifest...</div>
                 ) : activities.map(act => (
                   <div key={act.id} className="stream-item">
                      <div className="stream-dot" />
                      <div className="stream-body">
                         <div className="stream-header">
                            <span className="stream-user">{act.user_name}</span>
                            <span className="stream-time">{act.timestamp}</span>
                         </div>
                         <div className="stream-action">{act.action}</div>
                         <div className="stream-details">{act.details}</div>
                      </div>
                   </div>
                 ))}
              </div>
              
              <Button variant="secondary" className="wr-neural-btn">
                INITIATE NEURAL LINK <ChevronRight size={14} />
              </Button>
           </article>
        </div>
      </div>

      <style>{`
        .war-room-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
        
        /* STATS */
        .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .wr-stat { 
          padding: 16px; border-radius: 16px; display: flex; align-items: center; gap: 12px; 
          position: relative; overflow: hidden; min-height: 80px;
        }
        .wr-stat-icon { color: var(--accent-primary); opacity: 0.6; flex-shrink: 0; }
        .wr-stat-content { display: flex; flex-direction: column; overflow: hidden; }
        .wr-stat-lbl { font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.4; margin-bottom: 2px; white-space: nowrap; }
        .wr-stat-val { font-size: 1.25rem; font-weight: 900; line-height: 1.1; font-family: 'Outfit', sans-serif; overflow: hidden; text-overflow: ellipsis; }

        /* VISION PANEL */
        .wr-vision-panel { padding: 24px; position: relative; height: 560px; display: flex; flex-direction: column; overflow: hidden; }
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

        /* FEED PANEL */
        .wr-feed-panel { padding: 20px; display: flex; flex-direction: column; height: 600px; }
        .wr-feed-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .live-indicator { display: flex; align-items: center; gap: 4px; font-size: 0.55rem; font-weight: 900; color: #ff4d4d; letter-spacing: 1px; }
        .live-dot { width: 5px; height: 5px; background: #ff4d4d; border-radius: 50%; animation: blink 1.5s infinite; }
        
        .activity-stream { flex: 1; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-right: 4px; }
        .stream-item { display: flex; gap: 12px; position: relative; }
        .stream-item::before {
          content: ''; position: absolute; left: 4px; top: 14px; bottom: -18px;
          width: 1px; background: rgba(255,255,255,0.05);
        }
        .stream-item:last-child::before { display: none; }
        .stream-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--accent-primary); background: #000; z-index: 1; margin-top: 3px; }
        .stream-body { flex: 1; min-width: 0; }
        .stream-header { display: flex; justify-content: space-between; font-size: 0.7rem; margin-bottom: 2px; }
        .stream-user { font-weight: 800; color: var(--t1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .stream-time { font-size: 0.55rem; opacity: 0.3; flex-shrink: 0; }
        .stream-action { font-size: 0.5rem; color: var(--accent-primary); font-weight: 900; letter-spacing: 0.8px; margin-bottom: 1px; }
        .stream-details { font-size: 0.65rem; color: var(--t3); line-height: 1.25; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; }

        .wr-neural-btn { width: 100%; margin-top: 16px; height: 44px; font-size: 0.65rem; font-weight: 900; letter-spacing: 1.5px; border-radius: 10px; }
        
        .hex-bg-pattern {
          position: absolute; inset: 0; opacity: 0.02; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill-rule='evenodd' stroke='%23fff' fill='none'/%3E%3C/svg%3E");
          background-size: 40px 40px;
        }
      `}</style>
    </section>
  );
}
