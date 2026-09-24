/**
 * Calendar days, in the household's own time zone.
 *
 * `toISOString()` is UTC: in Tokyo it files Monday-morning cooking under
 * Sunday, and in California a Tuesday dinner under Wednesday. Everything
 * HomeCook stores as a day goes through here instead.
 */

/** `YYYY-MM-DD` for the local calendar day containing `date`. */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole calendar days from `a` to `b`, both `YYYY-MM-DD`. */
export function daysBetween(a: string, b: string): number {
  // Both parse as UTC midnight, so a daylight-saving change can't shave an hour off.
  const ms = Date.parse(b) - Date.parse(a);
  return Math.round(ms / 86_400_000);
}
