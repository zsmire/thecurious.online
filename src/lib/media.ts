import type { ImageMetadata } from 'astro';

/**
 * Photos live in src/media/photos and are referenced from frontmatter by
 * their public path ("/media/photos/foo.jpg") — the convention Pages CMS
 * writes. At build time Astro's image service turns the original into
 * resized WebP variants; the original file is never copied to the site.
 */
const files = import.meta.glob<{ default: ImageMetadata }>(
  '/src/media/photos/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG}',
  { eager: true },
);

export function resolvePhoto(publicPath: string): ImageMetadata | undefined {
  const key = publicPath.replace(/^\/media\//, '/src/media/');
  return files[key]?.default;
}

export function missingPhotoMessage(publicPath: string): string {
  return `Photo not found: ${publicPath}. Expected a file at src${publicPath.replace(/^\/media/, '/media')}.`;
}
