import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useCloudSyncStore } from '../services/cloudSyncService';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface UsePWAResult {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  closePrompt: () => void;
  isOffline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  installApp: () => Promise<boolean>;
}

export function usePWA(): UsePWAResult {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const navigatorStandalone = (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
      return isStandalone || navigatorStandalone;
    }
    return false;
  });

  const storeIsOnline = useCloudSyncStore((state) => state.isOnline);
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return !navigator.onLine;
    }
    return !storeIsOnline;
  });

  useEffect(() => {
    setIsOffline(!storeIsOnline);
  }, [storeIsOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      useCloudSyncStore.getState().setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOffline(true);
      useCloudSyncStore.getState().setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Kiểm tra phiên bản mới định kỳ mỗi 60 phút
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error: unknown) {
      console.warn('[PWA] Service Worker registration failed:', error);
    },
  });

  // Bắt sự kiện beforeinstallprompt & appinstalled
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Gọi hiển thị prompt cài đặt A2HS
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) {
      return false;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Installation prompt error:', err);
      return false;
    }
  }, [installPrompt]);

  const closePrompt = useCallback(() => {
    setOfflineReady(false);
    setNeedRefresh(false);
  }, [setOfflineReady, setNeedRefresh]);

  const isInstallable = Boolean(installPrompt) && !isInstalled;

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
    closePrompt,
    isOffline,
    isInstallable,
    isInstalled,
    installApp,
  };
}
