/**
 * Referral codes ride on a link (/register?ref=CODE). The code is remembered from the first
 * visit so it survives the landing → pricing → sign-up journey. Validation and rewards are
 * server-side; a bad code is silently ignored.
 */
const KEY = "sl_ref";
const CODE = /^[A-Za-z0-9]{8}$/;

export function captureReferral(search: string = typeof window !== "undefined" ? window.location.search : ""): void {
  try {
    const ref = new URLSearchParams(search).get("ref")?.trim();
    if (ref && CODE.test(ref)) window.localStorage.setItem(KEY, ref.toUpperCase());
  } catch { /* storage blocked — the link still works while the page is open */ }
}

export function storedReferral(): string | undefined {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && CODE.test(v) ? v : undefined;
  } catch { return undefined; }
}

export function referralLink(code: string, origin: string = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}/register?ref=${encodeURIComponent(code)}`;
}
