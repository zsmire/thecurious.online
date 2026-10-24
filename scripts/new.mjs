#!/usr/bin/env node
// Create a note, link or post from the terminal.
//
//   npm run note "Finally understood why X."            → src/content/notes/2026-10-24-2041.md
//   npm run note "O idee în română" --ro --tags idei
//   npm run link https://example.com "Title" "Why it's worth it"
//   npm run link https://example.com                     (title fetched from the page)
//   npm run post "A longer thought"                      → draft post, open it in your editor
//
// Flags: --ro (entry is in Romanian; default is English), --tags a,b,c, --date 2026-10-20T14:30, --publish (posts: draft:false)
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONTENT, parseArgs, isoMinute, datePrefix, slugify, writeEntry, uniquePath, relative } from './lib.mjs';

const [kind, ...rest] = process.argv.slice(2);
const { flags, pos } = parseArgs(rest);

if (!['note', 'link', 'post'].includes(kind)) {
  console.error('usage: node scripts/new.mjs <note|link|post> ...');
  process.exit(1);
}

const when = flags.date ? new Date(flags.date) : new Date();
const date = isoMinute(when);
const day = datePrefix(when);
const lang = flags.ro ? 'ro' : 'en';
const tags =
  typeof flags.tags === 'string'
    ? flags.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
const hhmm = date.slice(11, 16).replace(':', '');

let file;
if (kind === 'note') {
  const text = pos.join(' ').trim();
  if (!text) {
    console.error('A note needs text: npm run note "..."');
    process.exit(1);
  }
  file = uniquePath(path.join(CONTENT, 'notes', `${day}-${hhmm}.md`));
  writeEntry(file, { date, lang, tags }, text);
}

if (kind === 'link') {
  const [url, givenTitle, ...why] = pos;
  if (!url || !/^https?:\/\//.test(url)) {
    console.error('A link needs a URL: npm run link https://… "title" "why"');
    process.exit(1);
  }
  let title = givenTitle;
  if (!title) title = (await fetchTitle(url)) ?? new URL(url).hostname;
  file = uniquePath(path.join(CONTENT, 'links', `${day}-${slugify(title) || hhmm}.md`));
  writeEntry(file, { date, lang, tags, title, url }, why.join(' '));
}

if (kind === 'post') {
  const title = pos.join(' ').trim();
  if (!title) {
    console.error('A post needs a title: npm run post "Title"');
    process.exit(1);
  }
  file = uniquePath(path.join(CONTENT, 'posts', `${day}-${slugify(title)}.md`));
  writeEntry(
    file,
    { date, lang, tags, title, description: '', draft: !flags.publish },
    'Write here. Delete `draft: true` (or run with --publish) when it is ready.',
  );
  const editor = process.env.VISUAL ?? process.env.EDITOR;
  if (editor) spawnSync(editor, [file], { stdio: 'inherit', shell: true });
}

console.log(`created ${relative(file)}`);

async function fetchTitle(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (thecurious.online link script)' },
      signal: AbortSignal.timeout(8000),
    });
    const html = (await res.text()).slice(0, 200_000);
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const t = og ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    return t ? decodeEntities(t.trim().replace(/\s+/g, ' ')) : undefined;
  } catch {
    return undefined;
  }
}
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
