import { SITE } from '../site';

/**
 * Dates in frontmatter are "wall clock in SITE.timeZone" unless they carry an
 * explicit offset or Z. The capture scripts write an offset; Pages CMS writes a
 * naive "2026-10-24T20:41". Both must render the same on CI (UTC) and on a
 * laptop in Bucharest, so naive strings are pinned to the site time zone here.
 */
export function parseSiteDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  const s = String(input).trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return new Date(s);
  // date only → noon, so the calendar day never flips in any zone
  const naive = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00` : s;
  const asUtc = new Date(naive + 'Z');
  if (isNaN(asUtc.getTime())) throw new Error(`Bad date: ${input}`);
  const offset = tzOffsetMinutes(asUtc, SITE.timeZone);
  return new Date(asUtc.getTime() - offset * 60_000);
}

/** Minutes east of UTC for `zone` at instant `d` (DST-aware). */
function tzOffsetMinutes(d: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((local - d.getTime()) / 60_000);
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(SITE.locale, { timeZone: SITE.timeZone, ...opts });

/** Some locales add a trailing period to short names ("oct."); the rail reads cleaner without it. */
const clean = (f: Intl.DateTimeFormat) => ({ format: (d: Date) => f.format(d).replace(/\.$/, '') });

export const fmtDay = fmt({ day: 'numeric' });
export const fmtWeekday = clean(fmt({ weekday: 'short' }));
export const fmtMonthShort = clean(fmt({ month: 'short' }));
export const fmtYear = fmt({ year: 'numeric' });
export const fmtMonthLong = fmt({ month: 'long', year: 'numeric' });
export const fmtClock = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "2026-10-24" in the site time zone */
export function dayKey(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return p; // en-CA gives ISO-like yyyy-mm-dd
}
export function monthKey(d: Date): string {
  return dayKey(d).slice(0, 7);
}
export function dayNumber(d: Date): string {
  return dayKey(d).slice(8, 10);
}
