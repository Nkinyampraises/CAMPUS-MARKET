import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Download, X, Share, Plus, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import appLogo from '@/assets/image/logoi.png';

// Custom, non-intrusive install experience for Android/Chromium (native prompt)
// and iOS Safari (manual "Add to Home Screen" instructions). Purely additive —
// it renders nothing once the app is installed or when running inside Capacitor.
// The native install event is owned by the shared usePwaInstall() store.

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const ANON_DELAY_MS = 25_000; // first-visit delay for logged-out users
const LOGIN_DELAY_MS = 3_000; // shortly after login

const recentlyDismissed = (): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === 'installed') return true;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
};

export function PWAInstallPrompt() {
  const { currentUser } = useAuth();
  const { canInstall, isInstalled, isIos, isCapacitorApp, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decide whether/when to surface the banner.
  useEffect(() => {
    if (isCapacitorApp || isInstalled || recentlyDismissed()) return;
    if (!canInstall && !isIos) return; // nothing to offer yet

    const delay = currentUser ? LOGIN_DELAY_MS : ANON_DELAY_MS;
    showTimerRef.current = setTimeout(() => {
      setIosMode(isIos && !canInstall);
      setVisible(true);
    }, delay);

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, [currentUser, canInstall, isIos, isInstalled, isCapacitorApp]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome !== 'accepted') {
      dismiss();
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border bg-card shadow-modal p-4">
        <div className="flex items-start gap-3">
          <img src={appLogo} alt="UNITRADE" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-primary" />
              Install UNITRADE
            </p>
            {iosMode ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Tap the Share icon
                <Share className="inline h-3.5 w-3.5 mx-1 -mt-0.5" />
                then choose <span className="font-semibold text-foreground">“Add to Home Screen”</span>
                <Plus className="inline h-3.5 w-3.5 mx-1 -mt-0.5" />
                to install the app.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Add UNITRADE to your home screen for a faster, full-screen, app-like experience.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!iosMode && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1 font-bold" onClick={install}>
              <Download className="mr-1.5 h-4 w-4" /> Install
            </Button>
            <Button size="sm" variant="outline" className="font-semibold" onClick={dismiss}>
              Not now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
