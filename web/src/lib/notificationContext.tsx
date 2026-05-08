import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './authContext';
import { Bell, MessageSquare, Shield, Zap, X } from 'lucide-react';

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string;
  is_read: boolean;
  created_at: string;
};

type Toast = Notification & { visible: boolean };

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeToasts, setActiveToasts] = useState<Toast[]>([]);

  const fetchNotifications = async () => {
    if (!user || !supabase) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const triggerToast = (notif: Notification) => {
    const newToast = { ...notif, visible: true };
    setActiveToasts(prev => [...prev, newToast]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setActiveToasts(prev => prev.map(t => t.id === notif.id ? { ...t, visible: false } : t));
      setTimeout(() => {
        setActiveToasts(prev => prev.filter(t => t.id !== notif.id));
      }, 500); // Wait for fade-out animation
    }, 5000);
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setActiveToasts([]);
      return;
    }

    fetchNotifications();

    if (!supabase) return;

    // Realtime subscription
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications(prev => [newNotif, ...prev]);
        triggerToast(newNotif);
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    if (!supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user || !supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const deleteAllNotifications = async () => {
    if (!user || !supabase) return;
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (!error) setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications }}>
      {children}
      
      {/* Visual Toast Overlay */}
      <div className="system-toast-container">
        {activeToasts.map((toast) => (
          <div key={toast.id} className={`system-toast ${toast.visible ? 'visible' : 'exit'} type-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'message' && <MessageSquare size={18} />}
              {toast.type === 'achievement' && <Zap size={18} />}
              {toast.type === 'system' && <Shield size={18} />}
              {toast.type === 'friend' && <Bell size={18} />}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-msg">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => setActiveToasts(prev => prev.filter(t => t.id !== toast.id))}>
              <X size={14} />
            </button>
            <div className="toast-progress" />
          </div>
        ))}
      </div>

      <style>{`
        .system-toast-container {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 12px;
          pointer-events: none;
        }

        .system-toast {
          pointer-events: auto;
          width: 320px;
          padding: 16px;
          border-radius: 16px;
          background: rgba(10, 10, 20, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          display: flex;
          gap: 14px;
          position: relative;
          overflow: hidden;
          animation: toastSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transition: all 0.4s ease;
        }

        .system-toast.exit {
          transform: translateX(120%);
          opacity: 0;
        }

        @keyframes toastSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .toast-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-primary);
          flex-shrink: 0;
        }

        .type-message .toast-icon { color: #a8a8ff; background: rgba(168, 168, 255, 0.1); }
        .type-achievement .toast-icon { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
        .type-friend .toast-icon { color: #10b981; background: rgba(16, 185, 129, 0.1); }

        .toast-content { flex: 1; }
        .toast-title { font-size: 0.85rem; font-weight: 900; color: #fff; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
        .toast-msg { font-size: 0.75rem; color: rgba(255, 255, 255, 0.6); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .toast-close {
          background: none; border: none; color: rgba(255, 255, 255, 0.2); 
          cursor: pointer; padding: 4px; border-radius: 4px; transition: 0.2s;
          align-self: flex-start;
        }
        .toast-close:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }

        .toast-progress {
          position: absolute; bottom: 0; left: 0; height: 3px;
          background: var(--accent-primary);
          animation: toastProgress 5s linear forwards;
        }

        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
