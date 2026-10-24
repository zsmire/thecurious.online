import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { allEntries, permalink, title } from '../lib/entries';
import { SITE } from '../site';

export async function GET(context: APIContext) {
  const entries = (await allEntries()).slice(0, 50);
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: entries.map((e) => ({
      title: title(e),
      link: permalink(e),
      pubDate: e.entry.data.date,
      description: e.kind === 'link' ? `${e.entry.data.url}\n\n${e.entry.body ?? ''}` : (e.entry.body ?? ''),
      categories: [e.kind, ...e.entry.data.tags],
    })),
    customData: `<language>en</language>`,
  });
}
