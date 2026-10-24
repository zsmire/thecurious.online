# thecurious.online

A daily stream: notes, links, photos with their places, and the occasional post. Astro, static, GitHub Pages.
Same stack as maracineanu.com, plus content collections, capture scripts and a browser CMS.

- **Stream** (`/`) — all entries newest first, grouped by day; sticky day numeral while you scroll through a day
- **Photos** (`/photos`) — strip of the latest, then a grid; each photo has its own page
- **Map** (`/map`) — every geotagged photo as a pin
- **Archive** (`/archive`) — by month, plus tags
- `rss.xml`, `feed.json`, `sitemap-index.xml`

## Posting

Four entry types, four folders of Markdown under `src/content/`. Each file has a `date`, `tags` and a `lang` (`en` by default; `ro` only marks the occasional Romanian entry for screen readers and feeds — there is no filter UI). The body below the frontmatter is the text / caption / "why".

### From the terminal (fastest)

```bash
npm run note "One or two sentences. No title."
npm run note "O idee în română." --ro --tags idei
npm run link https://example.com "Title" "Why it's worth the click"
npm run link https://example.com            # title fetched from the page
npm run photo ~/Downloads/IMG_4521.jpg "Lipscani at dusk" --tags bucharest
npm run post "A longer thought"             # creates a draft and opens it in $EDITOR
npm run publish                             # git add + commit + push → deploys in ~1 min
```

`npm run photo` reads the EXIF (date taken, GPS, camera), looks up a place name from the GPS, resizes to 2400 px, re-encodes, and **strips all metadata** from the published file. The coordinates live only in the `.md` frontmatter, which is what the map reads. Flags: `--place "…"`, `--alt "…"`, `--ro`, `--tags a,b`, `--date 2026-10-20T14:30`, `--no-geocode`.

Common flags for all three: `--ro` for a Romanian entry, `--tags a,b`, `--date YYYY-MM-DDTHH:mm`.

### From the phone (Pages CMS)

1. Go to <https://app.pagescms.org>, sign in with GitHub, install the app on `zsmire/thecurious.online`.
2. The four collections appear (config is `.pages.yml`). Add a photo: upload from the camera roll, type a caption, save.
3. The save is a commit. The deploy workflow then resizes and strips the photo, fills `lat`/`lng`/`place` from its GPS, commits that back, and publishes. ~2 minutes from phone to site.

### By hand

Any text editor. The frontmatter for a photo:

```yaml
---
date: "2026-10-24T18:12+03:00"   # naive times ("2026-10-24T18:12") are read as Europe/Bucharest
lang: en
tags: [bucharest, street]
image: "/media/photos/2026-10-24-lipscani-bucharest.jpg"
place: "Lipscani, Bucharest"
lat: 44.4312
lng: 26.1015
---
Caption in Markdown.
```

Set `draft: true` on anything to keep it out of the build.

## Local development

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm run preview
```

Placeholder content lives in `src/content/*` and `src/media/photos/`. Delete it once you have real entries.

## How it is built

| Piece | Where |
|---|---|
| Site config (name, author, language, time zone, page size) | `src/site.ts` |
| Entry schemas | `src/content.config.ts` |
| Merge + sort the four collections | `src/lib/entries.ts` |
| Resolve `/media/photos/x.jpg` → optimised build asset | `src/lib/media.ts` |
| Time zone handling | `src/lib/dates.ts` |
| Design tokens (colors, type, layout) | `src/styles/global.css` |
| Layout, nav, theme toggle, page transitions | `src/layouts/Base.astro` |
| One entry (note / link / photo / post) | `src/components/Entry.astro` |
| Capture scripts | `scripts/` |
| CI: optimise photos → build → deploy | `.github/workflows/deploy.yml` |
| Pages CMS config | `.pages.yml` |

UI strings live in the page templates; dates are formatted with the locale in `src/site.ts` (see `src/lib/dates.ts`). Navigation is client-side (Astro ClientRouter): the header persists, photos morph between the stream and their own page. Theme: system by default, with a toggle in the header remembered per browser.

Photos are stored in `src/media/photos/` and referenced by public path. At build, Astro's image service produces WebP variants at several widths; the original is never copied to the site. Fonts (Fraunces for reading, Bricolage Grotesque for the chrome and day numerals) and Leaflet are bundled from npm; the only third-party request a visitor makes is for map tiles on `/map`.

### Limits worth knowing

- GitHub Pages: repo recommended < 1 GB, site < 1 GB, ~100 GB/month bandwidth (soft). With photos capped at 2400 px (~300–600 KB each) that is years of daily photos. If it ever gets tight, move `src/media/photos` to Cloudflare R2 and point `resolvePhoto()` at remote URLs — nothing else changes.
- The optimise job commits to `main`. After posting from the phone, `git pull` before you push from the laptop.

## First-time setup (one evening)

### 1. Laptop

```bash
node -v                       # need 22.x; otherwise: nvm install 22 && nvm use 22
unzip thecurious.zip && cd thecurious
npm install
npm run dev                   # open http://localhost:4321, check it renders
```

Open the folder in WebStorm. Recommended: Settings → Plugins → install **Astro** (JetBrains official). Settings → Languages & Frameworks → JavaScript → Prettier → "Run on save", and `npm i -D prettier prettier-plugin-astro` if you want formatting (config is in `.prettierrc`).

### 2. GitHub

```bash
git init -b main
git add -A
git commit -m "Initial site"
gh repo create zsmire/thecurious.online --public --source=. --push   # or create it on github.com and git remote add origin … && git push -u origin main
```

Then on github.com → the repo → **Settings → Pages**:
- Source: **GitHub Actions**
- Custom domain: `thecurious.online` → Save (it will show a DNS check; it passes once step 3 propagates)
- Enforce HTTPS: tick after the certificate is issued (can take up to an hour after DNS resolves)

The first push already ran the `Deploy` workflow (Actions tab). If the repo name is not `thecurious.online`, update `repo` in `src/site.ts`.

### 3. GoDaddy DNS

GoDaddy → My Products → DNS for thecurious.online. Delete the parked `A @` record GoDaddy added, then:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | 600 |
| A | @ | 185.199.109.153 | 600 |
| A | @ | 185.199.110.153 | 600 |
| A | @ | 185.199.111.153 | 600 |
| CNAME | www | zsmire.github.io | 600 |

Leave MX/TXT alone if you use the domain for mail. GoDaddy's "forwarding" for the domain must be **off** (it adds its own A record and fights yours). Check with `dig +short thecurious.online` — four GitHub IPs means done. `public/CNAME` keeps the custom domain bound across deploys.

### 4. Pages CMS

<https://app.pagescms.org> → Sign in with GitHub → install on your account, select `thecurious.online` → open it. If it does not pick up `.pages.yml`, Settings in the CMS → refresh config. Add it to your phone's home screen.

### 5. First real entry

Delete the placeholders, then:

```bash
rm -rf src/content/*/* src/media/photos/*
npm run note "Hello."
npm run photo ~/path/to/a.jpg "First one."
npm run publish
```

## Ops loop

edit → `npm run publish` (or save in Pages CMS) → GitHub Actions builds → live in about a minute. Nothing else.
