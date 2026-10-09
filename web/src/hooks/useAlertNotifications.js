import { useEffect } from 'react';
import { addRealtimeListener } from './useSocket';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useI18n } from '../i18n/useI18n';
import { describeCapability } from '../utils/capabilities';

/** Browser Notification API for `alert:raised` (foreground or background tab). */
export function useAlertNotifications(enabled) {
  const { t } = useI18n();

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof Notification === 'undefined') return undefined;

    const off = addRealtimeListener((event, payload) => {
      if (event !== 'alert:raised' || !payload) return;
      if (Notification.permission !== 'granted') return;

      const label = describeCapability(payload.capability).label;
      const body = t('alert.body', {
        label,
        value: payload.value,
        severity: payload.severity,
      });

      try {
        const n = new Notification(t('alert.title'), {
          body,
          tag: payload.alertId || `${payload.deviceId}:${payload.capability}`,
          icon: '/favicon.ico',
        });
        void n;
      } catch {
        /* unsupported environment */
      }
    });

    return off;
  }, [enabled, t]);
}

/** Request notification permission; returns final permission string. */
export async function requestAlertPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}
