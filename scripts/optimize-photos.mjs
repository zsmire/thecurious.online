#!/usr/bin/env node
// Make every file in src/media/photos safe and small. Idempotent; runs in CI on every push.
//
// For each image:
//   - if it carries EXIF GPS and its entry (.md with the same basename) has no lat/lng,
//     copy the coordinates into the entry and look up a place name when missing
//   - if it is larger than 2400px on the long edge, or carries any metadata at all,
//     re-encode it: resized, orientation baked in, metadata stripped
//
// This is what makes phone uploads through Pages CMS as safe as the local `npm run photo` path.
import { readdirSync, statSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { CONTENT, MEDIA, MAX_EDGE, readEntry, writeEntry, reverseGeocode, relative } from './lib.mjs';

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const files = existsSync(MEDIA) ? readdirSync(MEDIA).filter((f) => exts.has(path.extname(f).toLowerCase())) : [];
let changed = 0;

for (const name of files) {
  const file = path.join(MEDIA, name);
  const entryFile = path.join(CONTENT, 'photos', `${path.parse(name).name}.md`);

  const meta = await sharp(file, { failOn: 'none' }).metadata();
  const hasMeta = Boolean(meta.exif || meta.icc || meta.xmp || meta.iptc);
  const tooBig = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE;

  // 1. rescue coordinates before they are stripped
  if (hasMeta && existsSync(entryFile)) {
    const { data, body } = readEntry(entryFile);
    if (data.lat == null || data.lng == null) {
      const gps = await exifr.gps(file).catch(() => null);
      if (gps?.latitude != null) {
        data.lat = Math.round(gps.latitude * 1e5) / 1e5;
        data.lng = Math.round(gps.longitude * 1e5) / 1e5;
        if (!data.place) data.place = await reverseGeocode(data.lat, data.lng);
        writeEntry(entryFile, data, body);
        console.log(`geo     ${relative(entryFile)}  ${data.lat},${data.lng}${data.place ? '  ' + data.place : ''}`);
        changed++;
      }
    }
  }

  // 2. shrink and strip
  if (hasMeta || tooBig) {
    const tmp = file + '.tmp';
    const ext = path.extname(name).toLowerCase();
    let img = sharp(file, { failOn: 'none' }).rotate();
    if (tooBig) img = img.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
    if (ext === '.png') img = img.png({ compressionLevel: 9 });
    else if (ext === '.webp') img = img.webp({ quality: 86 });
    else if (ext === '.avif') img = img.avif({ quality: 60 });
    else img = img.jpeg({ quality: 86, mozjpeg: true });
    const before = statSync(file).size;
    const info = await img.toFile(tmp);
    renameSync(tmp, file);
    console.log(
      `image   ${relative(file)}  ${meta.width}×${meta.height} → ${info.width}×${info.height}  ${kb(before)} → ${kb(info.size)}`,
    );
    changed++;
  }
}

console.log(changed ? `${changed} change(s)` : 'nothing to do');

function kb(n) {
  return `${(n / 1024).toFixed(0)} KB`;
}
