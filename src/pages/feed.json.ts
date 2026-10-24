import type { APIContext } from 'astro';
import { allEntries, permalink, title } from '../lib/entries';
import { SITE } from '../site';

export async function GET(context: APIContext) {
  const site = context.site!.href.replace(/\/$/, '');
  const entries = (await allEntries()).slice(0, 50);
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE.name,
    home_page_url: site,
    feed_url: `${site}/feed.json`,
    description: SITE.description,
    language: 'en',
    items: entries.map((e) => ({
      id: `${site}${permalink(e)}`,
      url: `${site}${permalink(e)}`,
      external_url: e.kind === 'link' ? e.entry.data.url : undefined,
      title: title(e),
      content_text: e.entry.body ?? '',
      date_published: e.entry.data.date.toISOString(),
      language: e.entry.data.lang,
      tags: [e.kind, ...e.entry.data.tags],
    })),
  };
  return new Response(JSON.stringify(feed, null, 2), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
}
