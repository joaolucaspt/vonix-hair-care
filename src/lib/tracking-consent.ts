/**
 * Optional analytics/marketing consent.
 * Necessary checkout, order-status and fraud-prevention operations do not depend on this value.
 * Unknown, corrupt or inaccessible preferences always mean tracking is denied.
 */
export const TRACKING_CONSENT_KEY = "vonix-tracking-consent-v1";
export const TRACKING_PREFERENCES_EVENT = "vonix:open-privacy-preferences";
export const TRACKING_SESSION_REJECTION_KEY = "vonix-tracking-rejected-session-v1";
export type TrackingConsent = "accepted" | "rejected";

export function getTrackingConsent(): TrackingConsent | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.sessionStorage.getItem(TRACKING_SESSION_REJECTION_KEY) === "rejected") return "rejected";
  } catch {
    // A blocked session store is also acceptable.
  }
  try {
    const saved = window.localStorage.getItem(TRACKING_CONSENT_KEY);
    return saved === "accepted" || saved === "rejected" ? saved : null;
  } catch {
    return null;
  }
}

export function hasTrackingConsent(): boolean {
  return getTrackingConsent() === "accepted";
}

function clearTrackingCookies(): void {
  if (typeof document === "undefined") return;
  try {
    for (const part of document.cookie.split(";")) {
      const key = part.trim().split("=")[0];
      if (!key || !/^(?:_ga(?:_|$)|_gid$|_gat(?:_|$)|_fbp$|_fbc$|_clck$|_clsk$)/.test(key)) continue;
      document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`;
      if (window.location.hostname === "vonixhair.com" || window.location.hostname.endsWith(".vonixhair.com")) {
        document.cookie = `${key}=; Max-Age=0; Path=/; Domain=vonixhair.com; SameSite=Lax`;
      }
    }
  } catch {
    // Cookie blocking is acceptable; optional tracking is denied nonetheless.
  }
}

/** Returns false when a browser does not permit saving the choice. */
export function saveTrackingConsent(choice: TrackingConsent): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(TRACKING_CONSENT_KEY, choice);
    try {
      window.sessionStorage.removeItem(TRACKING_SESSION_REJECTION_KEY);
    } catch {
      // With an inaccessible session store, default-deny still applies.
    }
    if (choice === "rejected") clearTrackingCookies();
    return true;
  } catch {
    if (choice === "rejected") {
      // Private windows may deny localStorage but permit sessionStorage.
      try {
        window.sessionStorage.setItem(TRACKING_SESSION_REJECTION_KEY, "rejected");
        clearTrackingCookies();
        return true;
      } catch {
        // Neither persistent store is available: caller keeps an in-memory rejection.
      }
    }
    return false;
  }
}
