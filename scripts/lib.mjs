// Shared helpers for the capture scripts. No dependencies beyond node + sharp + exifr.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
export const CONTENT = path.join(ROOT, 'src', 'content');
export const MEDIA = path.join(ROOT, 'src', 'media', 'photos');
export const MEDIA_PUBLIC = '/media/photos';
export const MAX_EDGE = 2400;

export function slugify(s, max = 48) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics: ș → s, ă → a
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** Local wall-clock time with offset, minute precision: "2026-10-24T20:41+03:00" */
export function isoMinute(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}
/** Local calendar day: "2026-10-24" */
export function datePrefix(d = new Date()) {
  return isoMinute(d).slice(0, 10);
}

/** Parse `--flag value`, `--flag=value`, bare `--flag` and positionals. */
export function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { flags, pos };
}

function yamlScalar(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s === '' || /[:#\-?&*!|>'"%@`{}\[\],]|^\s|\s$|^(true|false|null|yes|no)$/i.test(s) || /^\d/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

/** Serialise a flat object (+ tags array) as YAML frontmatter. Keys in insertion order. */
export function frontmatter(data) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(yamlScalar).join(', ')}]`);
    else lines.push(`${k}: ${yamlScalar(v)}`);
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

/** Read a markdown file into { data, body } — flat YAML only, which is all we write. */
export function readEntry(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!mm) continue;
    let [, k, v] = mm;
    v = v.trim();
    if (/^\[.*\]$/.test(v))
      data[k] = v
        .slice(1, -1)
        .split(',')
        .map((x) => unquote(x.trim()))
        .filter(Boolean);
    else if (/^-?\d+(\.\d+)?$/.test(v)) data[k] = Number(v);
    else if (v === 'true' || v === 'false') data[k] = v === 'true';
    else data[k] = unquote(v);
  }
  return { data, body: m[2] };
}
function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return s.startsWith('"') ? JSON.parse(s) : s.slice(1, -1);
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}

export function writeEntry(file, data, body = '') {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, frontmatter(data) + (body ? body.trim() + '\n' : ''));
}

export function uniquePath(file) {
  if (!existsSync(file)) return file;
  const { dir, name, ext } = path.parse(file);
  let i = 2;
  while (existsSync(path.join(dir, `${name}-${i}${ext}`))) i++;
  return path.join(dir, `${name}-${i}${ext}`);
}

/** Reverse-geocode with Nominatim. Returns "Neighbourhood, City" style string or undefined. */
export async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'thecurious.online photo script (github.com/zsmire/thecurious.online)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const j = await res.json();
    const a = j.address ?? {};
    const local = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.village ?? a.hamlet ?? a.road;
    const city = a.city ?? a.town ?? a.municipality ?? a.county ?? a.state;
    const country = a.country;
    const parts = [local, city, country && country !== 'Romania' ? country : undefined].filter(Boolean);
    // de-dup e.g. "Bucharest, Bucharest"
    return [...new Set(parts)].join(', ') || undefined;
  } catch {
    return undefined;
  }
}

export function relative(file) {
  return path.relative(ROOT, file);
}
