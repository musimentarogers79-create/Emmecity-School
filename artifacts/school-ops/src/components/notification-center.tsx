import { useEffect, useRef, useState } from 'react';
import { Bell, Check, MonitorSmartphone } from 'lucide-react';
import { getGetOperationsQueryKey, useGetCurrentUser, useGetOperations } from '@workspace/api-client-react';
import { Button, Panel } from '@/components/school-shell';

const seenKey = (userId: string) => `emmecty:seen-notifications:${userId}`;

async function showDeviceNotification() {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  const options: NotificationOptions = {
    body: 'Sign in to the EMMECTY school portal to view this notification.',
    icon: `${import.meta.env.BASE_URL}school-logo.png`,
    badge: `${import.meta.env.BASE_URL}school-logo.png`,
    tag: 'emmecty-school-notification',
  };
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('New school notification', options);
      return;
    } catch {
      // Fall back to the page notification when the worker cannot display it.
    }
  }
  new Notification('New school notification', options);
}

export function NotificationCenter() {
  const { data: session } = useGetCurrentUser();
  const user = session?.user;
  const operations = useGetOperations({
    query: {
      enabled: Boolean(user),
      queryKey: getGetOperationsQueryKey(),
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  });
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [message, setMessage] = useState('');
  const firstLoad = useRef(true);
  const previousUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!user?.id || !operations.data?.modules.notifications) return;
    if (previousUserId.current !== user.id) {
      previousUserId.current = user.id;
      firstLoad.current = true;
    }
    const notifications = operations.data.modules.notifications;
    const storageKey = seenKey(user.id);
    let saved: unknown = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      saved = [];
    }
    const stored = new Set<string>(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []);
    const currentIds = notifications.map((item) => item.id);
    if (firstLoad.current) {
      firstLoad.current = false;
      currentIds.forEach((id) => stored.add(id));
      localStorage.setItem(storageKey, JSON.stringify(Array.from(stored).slice(-100)));
      return;
    }
    const fresh = notifications.filter((item) => !stored.has(item.id));
    if (fresh.length && permission === 'granted') {
      const latest = fresh[0];
      void showDeviceNotification();
      setMessage(`Latest alert: ${latest.title}`);
    }
    currentIds.forEach((id) => stored.add(id));
    localStorage.setItem(storageKey, JSON.stringify(Array.from(stored).slice(-100)));
  }, [operations.data, permission, user?.id]);

  const enableNotifications = async () => {
    if (permission === 'unsupported') {
      setMessage('This browser does not support device notifications.');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setMessage('Device notifications are enabled on this device.');
      await showDeviceNotification();
    } else if (result === 'denied') {
      setMessage('Notifications are blocked. Allow them in this browser or device settings.');
    }
  };

  if (!user || permission === 'granted') {
    return message ? <p className="mb-5 flex items-center gap-2 text-xs text-[hsl(var(--primary))]" role="status"><Check className="size-3.5" />{message}</p> : null;
  }

  return (
    <Panel className="mb-6 flex flex-col gap-4 border-[hsl(var(--primary)/.25)] bg-[hsl(var(--secondary)/.25)] p-4 sm:flex-row sm:items-center sm:justify-between" testId="panel-device-notifications">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><MonitorSmartphone className="size-4" /></span>
        <div>
          <p className="text-sm font-semibold">Get school alerts on this device</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">{permission === 'unsupported' ? 'Use a modern browser to receive announcements, school events, and public-holiday reminders.' : permission === 'denied' ? 'Notifications are currently blocked by this device or browser.' : 'Allow device notifications for announcements, events, and public holidays. Repeat this on each phone or computer you use.'}</p>
        </div>
      </div>
      {permission !== 'unsupported' && permission !== 'denied' && <Button onClick={enableNotifications} testId="button-enable-device-notifications"><Bell className="size-4" /> Enable alerts</Button>}
    </Panel>
  );
}