import { useCallback, useEffect, useState } from 'react';
import {
  getNotificationBackend,
  getNotificationPermission,
  readNativePermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../services/habitReminders';

export const useNotificationPermission = () => {
  const backend = getNotificationBackend();
  const [permission, setPermission] = useState<NotificationPermissionState>(() => getNotificationPermission());

  const refresh = useCallback(async () => {
    if (backend === 'native') {
      setPermission(await readNativePermission());
      return;
    }
    setPermission(getNotificationPermission());
  }, [backend]);

  useEffect(() => {
    void refresh();
    if (backend !== 'web' || !('Notification' in window)) return undefined;
    const interval = window.setInterval(() => {
      setPermission(getNotificationPermission());
    }, 2000);
    return () => window.clearInterval(interval);
  }, [backend, refresh]);

  const requestPermission = useCallback(async () => {
    const next = await requestNotificationPermission();
    setPermission(next);
    return next;
  }, []);

  return { permission, backend, refresh, requestPermission };
};
