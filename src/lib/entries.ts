import { getCollection, type CollectionEntry } from 'astro:content';
import { dayKey, monthKey, fmtMonthLong } from './dates';
export { dayKey };

export type Kind = 'note' | 'link' | 'photo' | 'post';

export type Entry =
  | { kind: 'note'; entry: CollectionEntry<'notes'> }
  | { kind: 'link'; entry: CollectionEntry<'links'> }
  | { kind: 'photo'; entry: CollectionEntry<'photos'> }
  | { kind: 'post'; entry: CollectionEntry<'posts'> };

const notDraft = (e: { data: { draft: boolean } }) => !e.data.draft;

export const isNote = (e: Entry): e is Extract<Entry, { kind: 'note' }> => e.kind === 'note';
export const isLink = (e: Entry): e is Extract<Entry, { kind: 'link' }> => e.kind === 'link';
export const isPhoto = (e: Entry): e is Extract<Entry, { kind: 'photo' }> => e.kind === 'photo';
export const isPost = (e: Entry): e is Extract<Entry, { kind: 'post' }> => e.kind === 'post';

/** Every published entry across the four collections, newest first. */
export async function allEntries(): Promise<Entry[]> {
  const [notes, links, photos, posts] = await Promise.all([
    getCollection('notes', notDraft),
    getCollection('links', notDraft),
    getCollection('photos', notDraft),
    getCollection('posts', notDraft),
  ]);
  const all: Entry[] = [
    ...notes.map((entry) => ({ kind: 'note' as const, entry })),
    ...links.map((entry) => ({ kind: 'link' as const, entry })),
    ...photos.map((entry) => ({ kind: 'photo' as const, entry })),
    ...posts.map((entry) => ({ kind: 'post' as const, entry })),
  ];
  return all.sort((a, b) => b.entry.data.date.getTime() - a.entry.data.date.getTime());
}

export function permalink(e: Entry): string {
  switch (e.kind) {
    case 'note':
      return `/notes/${e.entry.id}`;
    case 'link':
      return `/links/${e.entry.id}`;
    case 'photo':
      return `/photos/${e.entry.id}`;
    case 'post':
      return `/posts/${e.entry.id}`;
  }
}

export function title(e: Entry): string {
  switch (e.kind) {
    case 'note':
      return (e.entry.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Note';
    case 'link':
      return e.entry.data.title;
    case 'photo':
      return e.entry.data.place ?? e.entry.data.alt ?? 'Photo';
    case 'post':
      return e.entry.data.title;
  }
}

/** Group a sorted list by calendar day (local to the build, which is UTC on CI). */
export function groupByDay(entries: Entry[]): { day: Date; key: string; entries: Entry[] }[] {
  const groups = new Map<string, { day: Date; key: string; entries: Entry[] }>();
  for (const e of entries) {
    const key = dayKey(e.entry.data.date);
    if (!groups.has(key)) groups.set(key, { day: e.entry.data.date, key, entries: [] });
    groups.get(key)!.entries.push(e);
  }
  return [...groups.values()];
}

export function groupByMonth(entries: Entry[]): { key: string; label: string; entries: Entry[] }[] {
  const groups = new Map<string, { key: string; label: string; entries: Entry[] }>();
  for (const e of entries) {
    const d = e.entry.data.date;
    const key = monthKey(d);
    if (!groups.has(key)) groups.set(key, { key, label: fmtMonthLong.format(d), entries: [] });
    groups.get(key)!.entries.push(e);
  }
  return [...groups.values()];
}

export function allTags(entries: Entry[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) for (const t of e.entry.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
