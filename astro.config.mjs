// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://thecurious.online',
  output: 'static',
  integrations: [sitemap()],
  image: {
    // Photos are resized at build time into WebP variants; originals are never served.
    responsiveStyles: true,
  },
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
