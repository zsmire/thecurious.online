import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { parseSiteDate } from './lib/dates';

/**
 * Four tiny entry types, one stream.
 *
 * Every entry shares: date, lang, tags. The body (markdown below the
 * frontmatter) is the caption for photos, the "why" for links, the text
 * for notes, and the article for posts.
 *
 * Files are Markdown with YAML frontmatter so that the capture scripts,
 * Pages CMS and a plain text editor all produce the same thing.
 */

/** The site is English. `lang` stays so an occasional Romanian entry can be marked for screen readers and feeds. */
const lang = z.enum(['en', 'ro']).default('en');
const tags = z.array(z.string()).default([]);
const date = z.union([z.string(), z.date()]).transform(parseSiteDate);

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    date,
    lang,
    tags,
    draft: z.boolean().default(false),
  }),
});

const links = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/links' }),
  schema: z.object({
    date,
    lang,
    tags,
    title: z.string(),
    url: z.url(),
    draft: z.boolean().default(false),
  }),
});

const photos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/photos' }),
  schema: z.object({
    date,
    lang,
    tags,
    /** Public path as Pages CMS writes it, e.g. "/media/photos/2026-10-24-lipscani.jpg" */
    image: z.string(),
    /** Short alt text; falls back to place */
    alt: z.string().optional(),
    place: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    camera: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    date,
    lang,
    tags,
    title: z.string(),
    description: z.string().optional(),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { notes, links, photos, posts };
