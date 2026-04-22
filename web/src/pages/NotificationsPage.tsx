import { useNotifications } from "../lib/notificationContext";
import { Bell, Check, Trash2, ExternalLink, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";

export function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const handleAction = async (n: any) => {
    await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title"><Bell size={22} style={{display:"inline",marginRight:8,verticalAlign:"middle"}} /> Notifications</h2>
          <p className="text-xs text-muted">System alerts, mission assignments, and duel requests</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <Button variant="secondary" size="sm" onClick={markAllAsRead}>
            <Check size={14} /> Mark all read
          </Button>
        )}
      </div>

      <div className="notifications-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notifications.length === 0 ? (
          <div className="panel panel-empty text-center py-40">
            <Inbox size={48} className="text-muted mb-16" style={{ opacity: 0.2, margin: "0 auto" }} />
            <h3 className="text-muted">Zero alerts</h3>
            <p className="text-xs text-muted">Your transmission log is currently empty.</p>
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              className={`panel notification-item ${!n.is_read ? 'notification-unread' : ''}`}
              style={{ 
                display: "flex", gap: 16, alignItems: "flex-start",
                borderLeft: !n.is_read ? "3px solid #a8a8ff" : "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: n.type === 'assignment' ? 'rgba(52,211,153,0.1)' : 
                            n.type === 'duel' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                display: "flex", alignItems: "center", justifyContent: "center",
                color: n.type === 'assignment' ? '#34d399' : 
                       n.type === 'duel' ? '#ef4444' : 'var(--t3)',
                flexShrink: 0
              }}>
                <Bell size={16} />
              </div>

              <div style={{ flex: 1 }}>
                <div className="flex-between">
                  <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--t1)" }}>{n.title}</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--t3)" }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--t2)", margin: "4px 0 10px" }}>{n.message}</p>
                
                <div className="flex gap-8">
                  {n.link && (
                    <Button variant="primary" size="sm" onClick={() => handleAction(n)}>
                      <ExternalLink size={12} /> View
                    </Button>
                  )}
                  {!n.is_read && !n.link && (
                    <Button variant="secondary" size="sm" onClick={() => markAsRead(n.id)}>
                      <Check size={12} /> Read
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => deleteNotification(n.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
