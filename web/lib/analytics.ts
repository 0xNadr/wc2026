type GoatCounterCount = (opts: { path: string; title?: string; event?: boolean }) => void;

declare global {
  interface Window {
    goatcounter?: { count?: GoatCounterCount };
  }
}

export function trackEvent(path: string, title?: string): void {
  if (typeof window === "undefined") return;
  window.goatcounter?.count?.({ path, title, event: true });
}
