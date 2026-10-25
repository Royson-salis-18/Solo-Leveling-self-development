import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './authContext';
import { useToast, type ToastType } from './toast';

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
  const { toast } = useToast();
  // The realtime handler is created once per user; keep the latest toast fn without resubscribing.
  const toastRef = useRef(toast);
  toastRef.current = toast;

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

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    if (!supabase) return;

    // Notifications that should appear in the bell but NOT pop up as a toast.
    // System-gate-spawned events are informational — showing them as toasts on
    // every page load is what was "bombarding" the user.
    const SILENT_TOAST_TITLES = new Set([
      "WEEKLY TRIAL",
      "SYSTEM GATE",
      "PENALTY ZONE",
      "SURVIVAL TEST",
      "EGO STABILIZATION",
    ]);

    const shouldToast = (title: string) => {
      const upper = title.toUpperCase();
      return !Array.from(SILENT_TOAST_TITLES).some(s => upper.includes(s));
    };

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
        // Only show toast for meaningful player events (LEVEL UP, RANK UP, DMs, etc.)
        if (shouldToast(newNotif.title)) {
          toastRef.current({ title: newNotif.title, message: newNotif.message, type: (newNotif.type as ToastType) || 'system' });
        }
      })
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    if (!supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user || !supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const deleteAllNotifications = useCallback(async () => {
    if (!user || !supabase) return;
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (!error) setNotifications([]);
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications }),
    [notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
