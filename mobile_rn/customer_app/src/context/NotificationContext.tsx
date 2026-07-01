import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ProfileService } from '../services/profile.service';

interface NotificationContextType {
  notifCount:        number;
  refreshNotifCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifCount:        0,
  refreshNotifCount: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifCount, setNotifCount] = useState(0);

  const refreshNotifCount = useCallback(async () => {
    try {
      const notifications = await ProfileService.listNotifications();
      setNotifCount(notifications.filter(n => !n.is_read).length);
    } catch {}
  }, []);

  useEffect(() => { refreshNotifCount(); }, []);

  return (
    <NotificationContext.Provider value={{ notifCount, refreshNotifCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
