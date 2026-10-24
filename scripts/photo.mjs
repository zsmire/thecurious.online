#!/usr/bin/env node
// Add a photo to the stream in one command.
//
//   npm run photo ~/Downloads/IMG_4521.jpg "Lipscani at dusk"
//   npm run photo IMG_4521.jpg "Seara pe Lipscani" --ro --place "Lipscani, Bucharest" --tags bucharest,street
//
// What it does:
//   1. reads EXIF: date taken, GPS, camera
//   2. reverse-geocodes GPS → place name (unless --place given, or --no-geocode)
//   3. resizes to 2400px on the long edge, re-encodes JPEG, STRIPS all metadata (GPS never ships)
//   4. writes src/media/photos/<date>-<slug>.jpg and src/content/photos/<date>-<slug>.md
//
// Flags: --place "…", --alt "…", --ro, --tags a,b, --date 2026-10-20T14:30, --no-geocode, --keep-size
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import {
  CONTENT,
  MEDIA,
  MEDIA_PUBLIC,
  MAX_EDGE,
  parseArgs,
  isoMinute,
  datePrefix,
  slugify,
  writeEntry,
  uniquePath,
  reverseGeocode,
  relative,
} from './lib.mjs';

const { flags, pos } = parseArgs(process.argv.slice(2));
const [src, ...captionParts] = pos;
if (!src) {
  console.error('usage: npm run photo <image> ["caption"] [--place "…"] [--ro] [--tags a,b]');
  process.exit(1);
}
const caption = captionParts.join(' ').trim();

// 1. EXIF
let exif = {};
try {
  exif = (await exifr.parse(src, { pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model'] })) ?? {};
  Object.assign(exif, (await exifr.gps(src)) ?? {});
} catch (e) {
  console.warn(`no EXIF read (${e.message})`);
}
const taken = flags.date ? new Date(flags.date) : (exif.DateTimeOriginal ?? exif.CreateDate ?? new Date());
const lat = typeof exif.latitude === 'number' ? round(exif.latitude) : undefined;
const lng = typeof exif.longitude === 'number' ? round(exif.longitude) : undefined;
const camera =
  [exif.Make, exif.Model]
    .filter(Boolean)
    .join(' ')
    .replace(/^Apple Apple/, 'Apple')
    .trim() || undefined;

// 2. place
let place = typeof flags.place === 'string' ? flags.place : undefined;
if (!place && lat != null && lng != null && !flags['no-geocode']) {
  process.stdout.write('looking up place… ');
  place = await reverseGeocode(lat, lng);
  console.log(place ?? '(not found — add place: to the .md)');
}

// 3. image
const slugSource = typeof flags.alt === 'string' ? flags.alt : place || caption || path.parse(src).name;
const base = `${datePrefix(taken)}-${slugify(slugSource) || 'photo'}`;
const outImg = uniquePath(path.join(MEDIA, `${base}.jpg`));
const img = sharp(src, { failOn: 'none' }).rotate(); // bake in EXIF orientation before stripping it
if (!flags['keep-size']) img.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
const info = await img.jpeg({ quality: 86, mozjpeg: true }).toFile(outImg); // sharp strips metadata by default

// 4. entry
const outMd = path.join(CONTENT, 'photos', `${path.parse(outImg).name}.md`);
writeEntry(
  outMd,
  {
    date: isoMinute(taken),
    lang: flags.ro ? 'ro' : 'en',
    tags:
      typeof flags.tags === 'string'
        ? flags.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    image: `${MEDIA_PUBLIC}/${path.basename(outImg)}`,
    alt: typeof flags.alt === 'string' ? flags.alt : undefined,
    place,
    lat,
    lng,
    camera,
  },
  caption,
);

console.log(`photo   ${relative(outImg)}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
console.log(`entry   ${relative(outMd)}`);
if (lat == null) console.log('no GPS in this file; add lat:/lng: by hand if you want it on the map');

function round(n) {
  return Math.round(n * 1e5) / 1e5; // ~1 m; enough for a map pin, less precise than the phone's raw fix
}
