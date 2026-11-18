import { useEffect } from 'react';

/**
 * Не даём экрану гаснуть (Screen Wake Lock API).
 * Работает в браузере и в Android WebView (Capacitor) — оба на Chromium.
 * Если API нет — тихо ничего не делает.
 */
export function useWakeLock(active = true): void {
  useEffect(() => {
    if (!active) return;

    const anyNav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || !anyNav.wakeLock) return;
      try {
        sentinel = await anyNav.wakeLock.request('screen');
      } catch {
        /* например, нет фокуса или не разрешено — просто пропускаем */
      }
    };

    void acquire();

    // После сворачивания/возврата лок нужно запросить заново.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        void sentinel?.release();
      } catch {
        /* ignore */
      }
    };
  }, [active]);
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
