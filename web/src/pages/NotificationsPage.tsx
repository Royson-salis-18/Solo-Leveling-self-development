import { useNotifications } from "../lib/notificationContext";
import { Bell, Check, Trash2, ExternalLink, Inbox, MessageSquare, Zap, Shield, UserPlus, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";


export function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();
  const navigate = useNavigate();

  const handleAction = async (n: any) => {
    await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  const handleWipeAll = async () => {
    if (window.confirm("ARE_YOU_SURE? THIS_WILL_PERMANENTLY_WIPE_ALL_TRANSMISSION_RECORDS.")) {
      await deleteAllNotifications();
    }
  };

  const getTypeStyles = (type: string) => {
    switch(type) {
      case 'message': return { icon: <MessageSquare size={16} />, color: '#a8a8ff', bg: 'rgba(168,168,255,0.1)', border: 'rgba(168,168,255,0.2)' };
      case 'achievement': return { icon: <Zap size={16} />, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' };
      case 'friend': return { icon: <UserPlus size={16} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' };
      case 'system': return { icon: <Shield size={16} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' };
      default: return { icon: <Bell size={16} />, color: 'var(--accent-primary)', bg: 'rgba(168,168,255,0.05)', border: 'rgba(168,168,255,0.1)' };
    }
  };

  return (
    <section className="page notifications-page">
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <div className="noti-eyebrow">SYSTEM_LOG_v5.0.4</div>
          <h2 className="page-title" style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: 16 }}>
            <Bell size={32} className="title-glow" /> 
            Transmissions
          </h2>
          <p className="text-muted" style={{ letterSpacing: '1px', opacity: 0.6, fontSize: '0.75rem', fontWeight: 700 }}>
            TACTICAL_OVERWATCH_FEED // {notifications.length} RECORDS FOUND
          </p>
        </div>
        
        <div className="flex gap-12">
          {notifications.some(n => !n.is_read) && (
            <button className="tactical-btn secondary" onClick={markAllAsRead}>
              <Check size={14} /> MARK_ALL_SYNCED
            </button>
          )}
          {notifications.length > 0 && (
            <button className="tactical-btn danger" onClick={handleWipeAll} style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <Trash size={14} /> WIPE_LOGS
            </button>
          )}
        </div>
      </div>

      <div className="notifications-grid">
        {notifications.length === 0 ? (
          <div className="empty-state-log">
            <div className="empty-radar">
              <div className="radar-circle" />
              <div className="radar-circle" />
              <div className="radar-sweep" />
              <Inbox size={48} className="empty-icon" />
            </div>
            <h3 className="empty-title">Zero Active Transmissions</h3>
            <p className="empty-desc">The Shadow Network is currently silent. No recent mana fluctuations detected.</p>
          </div>
        ) : (
          <div className="noti-list-v2">
            {notifications.map((n, idx) => {
              const styles = getTypeStyles(n.type);
              return (
                <div 
                  key={n.id} 
                  className={`noti-card-v2 ${!n.is_read ? 'is-unread' : ''} type-${n.type}`}
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  <div className="noti-accent-bar" style={{ background: styles.color }} />
                  
                  <div className="noti-main-layout">
                    <div className="noti-icon-container" style={{ color: styles.color, background: styles.bg, borderColor: styles.border }}>
                      {styles.icon}
                      {!n.is_read && <div className="noti-unread-pulse" style={{ background: styles.color }} />}
                    </div>

                    <div className="noti-content-v2">
                      <div className="noti-header-row">
                        <span className="noti-type-tag" style={{ color: styles.color, background: styles.bg }}>
                          {n.type || 'system'}
                        </span>
                        <span className="noti-timestamp">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="noti-title-v2">{n.title}</h3>
                      <p className="noti-message-v2">{n.message}</p>
                      
                      <div className="noti-actions-v2">
                        {n.link && (
                          <button className="action-btn-v2 primary" onClick={() => handleAction(n)}>
                            <ExternalLink size={14} /> ACCESS_LINK
                          </button>
                        )}
                        {!n.is_read && !n.link && (
                          <button className="action-btn-v2 secondary" onClick={() => markAsRead(n.id)}>
                            <Check size={14} /> SYNC_RECORD
                          </button>
                        )}
                        <button className="action-btn-v2 ghost" onClick={() => deleteNotification(n.id)}>
                          <Trash2 size={14} /> DELETE
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .noti-eyebrow { font-size: 0.65rem; font-weight: 900; color: var(--accent-primary); letter-spacing: 4px; margin-bottom: 8px; opacity: 0.8; }
        .title-glow { filter: drop-shadow(0 0 15px var(--accent-primary)); color: var(--accent-primary); }
        
        .tactical-btn { 
          display: flex; align-items: center; gap: 10px; padding: 12px 20px; 
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.7);
          font-size: 0.7rem; font-weight: 900; letter-spacing: 2px;
          cursor: pointer; transition: 0.3s;
        }
        .tactical-btn:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.2); }
        .tactical-btn.secondary { border-color: rgba(168,168,255,0.3); color: var(--accent-primary); }
        .tactical-btn.secondary:hover { background: rgba(168,168,255,0.1); border-color: var(--accent-primary); }

        .noti-list-v2 { display: flex; flex-direction: column; gap: 16px; }
        
        .noti-card-v2 {
          position: relative; overflow: hidden;
          background: rgba(15,15,25,0.4); backdrop-filter: blur(25px);
          border: 1px solid rgba(255,255,255,0.06); border-radius: 24px;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: notiIn 0.6s both;
        }
        @keyframes notiIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .noti-card-v2:hover { transform: translateX(8px); border-color: rgba(255,255,255,0.12); background: rgba(20,20,35,0.6); }
        .noti-card-v2.is-unread { border-left-width: 0; background: rgba(168,168,255,0.03); }
        .noti-card-v2.is-unread::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(168,168,255,0.05), transparent); pointer-events: none; }

        .noti-accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; opacity: 0.5; }
        .is-unread .noti-accent-bar { opacity: 1; box-shadow: 0 0 15px currentColor; }

        .noti-main-layout { display: flex; gap: 24px; padding: 24px; }
        
        .noti-icon-container {
          width: 56px; height: 56px; border-radius: 18px; border: 1px solid;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; position: relative;
        }
        
        .noti-unread-pulse {
          position: absolute; top: -4px; right: -4px; width: 12px; height: 12px;
          border-radius: 50%; border: 2px solid #000;
          animation: pulseShadow 2s infinite;
        }
        @keyframes pulseShadow { 0% { transform: scale(0.9); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.5; } 100% { transform: scale(0.9); opacity: 1; } }

        .noti-content-v2 { flex: 1; }
        .noti-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .noti-type-tag { font-size: 0.6rem; font-weight: 950; text-transform: uppercase; letter-spacing: 2px; padding: 4px 10px; border-radius: 6px; }
        .noti-timestamp { font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.25); font-family: monospace; }
        
        .noti-title-v2 { font-size: 1.15rem; font-weight: 900; color: #fff; margin-bottom: 6px; letter-spacing: -0.5px; }
        .noti-message-v2 { font-size: 0.85rem; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 20px; max-width: 800px; }
        
        .noti-actions-v2 { display: flex; gap: 12px; }
        .action-btn-v2 { 
          display: flex; align-items: center; gap: 8px; padding: 8px 16px; 
          border-radius: 10px; font-size: 0.65rem; font-weight: 900; 
          letter-spacing: 1px; cursor: pointer; transition: 0.2s; border: 1px solid transparent;
        }
        .action-btn-v2.primary { background: var(--accent-primary); color: #000; }
        .action-btn-v2.primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(168,168,255,0.3); }
        .action-btn-v2.secondary { background: rgba(255,255,255,0.05); color: #fff; border-color: rgba(255,255,255,0.1); }
        .action-btn-v2.secondary:hover { background: rgba(255,255,255,0.1); }
        .action-btn-v2.ghost { background: transparent; color: rgba(255,255,255,0.3); }
        .action-btn-v2.ghost:hover { color: #ef4444; background: rgba(239,68,68,0.05); }

        .empty-state-log { text-align: center; padding: 100px 0; max-width: 500px; margin: 0 auto; opacity: 0.8; }
        .empty-radar { position: relative; width: 120px; height: 120px; margin: 0 auto 32px; display: flex; align-items: center; justify-content: center; }
        .radar-circle { position: absolute; border: 1px solid rgba(168,168,255,0.1); border-radius: 50%; width: 100%; height: 100%; }
        .radar-circle:nth-child(2) { width: 60%; height: 60%; }
        .radar-sweep { position: absolute; inset: 0; background: conic-gradient(from 0deg, rgba(168,168,255,0.2), transparent 90deg); border-radius: 50%; animation: sweep 4s linear infinite; }
        .empty-icon { position: relative; z-index: 2; opacity: 0.3; color: var(--accent-primary); }
        .empty-title { font-size: 1.5rem; font-weight: 900; color: #fff; margin-bottom: 12px; }
        .empty-desc { font-size: 0.85rem; color: rgba(255,255,255,0.4); line-height: 1.5; }
      `}</style>
    </section>
  );
}
