/**
 * Thin, defensive wrapper around MAX Bridge (window.WebApp, loaded from
 * https://st.max.ru/js/max-web-app.js — see dev.max.ru/docs/webapps/bridge).
 * Every call degrades gracefully in a plain browser, so the same build works
 * inside MAX (mobile + desktop/web) and in the browser sandbox.
 */

type HapticImpact = "soft" | "light" | "medium" | "heavy" | "rigid";
type HapticNotice = "error" | "success" | "warning";

interface MaxWebApp {
  initData?: string;
  platform?: "ios" | "android" | "desktop" | "web";
  version?: string;
  ready?: () => void;
  close?: () => void;
  openLink?: (url: string) => void;
  openMaxLink?: (url: string) => void;
  shareMaxContent?: (params: { text?: string; link?: string }) => unknown;
  shareContent?: (params: { text?: string; link?: string }) => unknown;
  requestContact?: () => Promise<{ phone: string; authDate: string; hash: string }>;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback?: {
    impactOccurred: (style: HapticImpact, disableVibrationFallback?: boolean) => void;
    notificationOccurred: (type: HapticNotice, disableVibrationFallback?: boolean) => void;
    selectionChanged: (disableVibrationFallback?: boolean) => void;
  };
}

declare global {
  interface Window {
    WebApp?: MaxWebApp;
  }
}

const app = (): MaxWebApp | undefined => (window.WebApp?.initData ? window.WebApp : undefined);

export const insideMax = (): boolean => Boolean(app());

function safe(fn: () => void) {
  try { fn(); } catch { /* bridge method unavailable on this platform */ }
}

export const haptic = {
  success: () => safe(() => app()?.HapticFeedback?.notificationOccurred("success", true)),
  error: () => safe(() => app()?.HapticFeedback?.notificationOccurred("error", true)),
  warning: () => safe(() => app()?.HapticFeedback?.notificationOccurred("warning", true)),
  tap: () => safe(() => app()?.HapticFeedback?.impactOccurred("light", true)),
  select: () => safe(() => app()?.HapticFeedback?.selectionChanged(true)),
};

/** Share into a MAX chat (native share sheet of MAX); falls back to the
 * system share sheet and finally to the clipboard. */
export async function shareToMax(text: string, link: string): Promise<"shared" | "copied" | "failed"> {
  const bridge = app();
  if (bridge?.shareMaxContent) {
    try {
      await bridge.shareMaxContent({ text, link });
      return "shared";
    } catch { /* fall through */ }
  }
  if (navigator.share) {
    try {
      await navigator.share({ text, url: link });
      return "shared";
    } catch { /* cancelled or unsupported */ }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${link}`);
    return "copied";
  } catch {
    return "failed";
  }
}

/** One-tap phone number from the MAX account (with the user's consent). */
export async function requestPhone(): Promise<string | null> {
  const bridge = app();
  if (!bridge?.requestContact) return null;
  try {
    const result = await bridge.requestContact();
    return result?.phone ? (result.phone.startsWith("+") ? result.phone : `+${result.phone}`) : null;
  } catch {
    return null;
  }
}

export const canRequestPhone = (): boolean => Boolean(app()?.requestContact);

/** Opens a max.ru deep link inside MAX (bot chat), or a new tab in a browser. */
export function openMax(url: string) {
  const bridge = app();
  if (bridge?.openMaxLink) {
    safe(() => bridge.openMaxLink!(url));
    return;
  }
  window.open(url, "_blank", "noopener");
}

export function openExternal(url: string) {
  const bridge = app();
  if (bridge?.openLink) {
    safe(() => bridge.openLink!(url));
    return;
  }
  window.open(url, "_blank", "noopener");
}

/** Shows the native MAX back button while `handler` is registered. */
export function bindBackButton(handler: (() => void) | null): () => void {
  const back = app()?.BackButton;
  if (!back || !handler) return () => {};
  safe(() => { back.onClick(handler); back.show(); });
  return () => safe(() => { back.offClick(handler); back.hide(); });
}

/** Warn before closing the mini app while an unsent answer is being typed. */
export function setClosingConfirmation(enabled: boolean) {
  const bridge = app();
  safe(() => (enabled ? bridge?.enableClosingConfirmation?.() : bridge?.disableClosingConfirmation?.()));
}

export const platform = (): string => app()?.platform || "web";
