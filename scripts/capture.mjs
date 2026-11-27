// Captures des sites clients pour le showcase.
// Usage : npm run capture            → tous les sites
//         npm run capture -- kanso   → un seul site (par slug)
//
// Sortie : public/proto/sites/<slug>/
//   desktop-1.jpg, desktop-2.jpg   (1440×900, haut de page puis un écran plus bas)
//   mobile-1.jpg,  mobile-2.jpg    (390×844 @2x)
//   video.webm                     (≈7 s de défilement, 960 px, VP9 léger, sans son)

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';

const SITES = [
  { slug: 'vulliet', url: 'https://dev.cedricstoecklin.com/' },
  { slug: 'kanso', url: 'https://dev2.cedricstoecklin.com/' },
  { slug: 'architypes', url: 'https://architypes.cedricstoecklin.com/' },
  { slug: 'cedricstoecklin', url: 'https://cedricstoecklin.com/' },
  { slug: 'urban-yellow', url: 'https://uy.cedricstoecklin.com/' },
];

const OUT = path.resolve('public/proto/sites');
const TMP = path.resolve('.capture-tmp');
const SETTLE = 4500; // attente après chargement (loaders, animations d'entrée)
const VIDEO_SECONDS = 7;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

// Masque les barres de défilement sans toucher à la mise en page des sites.
const HIDE_SCROLLBARS = `
  html { scrollbar-width: none !important; }
  ::-webkit-scrollbar { display: none !important; }
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(context, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.addStyleTag({ content: HIDE_SCROLLBARS }).catch(() => {});
  await sleep(SETTLE);
  return page;
}

// Défilement à la molette : déclenche Lenis / ScrollTrigger comme un vrai visiteur.
async function wheel(page, distance, duration) {
  const steps = Math.max(1, Math.round(duration / 50));
  const delta = distance / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, delta);
    await sleep(50);
  }
}

async function shots(browser, site, dir, kind) {
  const mobile = kind === 'mobile';
  const context = await browser.newContext({
    viewport: mobile ? MOBILE : DESKTOP,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await open(context, site.url);
  const vh = (mobile ? MOBILE : DESKTOP).height;

  await page.screenshot({ path: path.join(dir, `${kind}-1.jpg`), type: 'jpeg', quality: 82 });

  if (mobile) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), vh * 1.2);
  } else {
    await page.mouse.move(DESKTOP.width / 2, DESKTOP.height / 2);
    await wheel(page, vh * 1.2, 1200);
  }
  await sleep(2000);
  await page.screenshot({ path: path.join(dir, `${kind}-2.jpg`), type: 'jpeg', quality: 82 });

  await context.close();
}

async function video(browser, site, dir) {
  await rm(TMP, { recursive: true, force: true });
  const context = await browser.newContext({
    viewport: DESKTOP,
    recordVideo: { dir: TMP, size: DESKTOP },
  });
  const t0 = Date.now();
  const page = await open(context, site.url);
  const start = (Date.now() - t0) / 1000; // on coupe le chargement

  await page.mouse.move(DESKTOP.width / 2, DESKTOP.height / 2);
  await sleep(600);
  await wheel(page, DESKTOP.height * 2.5, (VIDEO_SECONDS - 1.2) * 1000);
  await sleep(600);
  await context.close();

  const [raw] = (await readdir(TMP)).filter((f) => f.endsWith('.webm'));
  if (!raw) throw new Error('pas de vidéo enregistrée');

  const res = spawnSync(
    ffmpegPath,
    [
      '-y', '-loglevel', 'error',
      '-ss', start.toFixed(2),
      '-i', path.join(TMP, raw),
      '-t', String(VIDEO_SECONDS),
      '-vf', 'scale=960:-2,fps=24',
      '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0',
      '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
      '-an',
      path.join(dir, 'video.webm'),
    ],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) throw new Error('ffmpeg a échoué');
  await rm(TMP, { recursive: true, force: true });
}

const only = process.argv[2];
const list = only ? SITES.filter((s) => s.slug === only) : SITES;
if (!list.length) {
  console.error(`Slug inconnu : ${only}. Disponibles : ${SITES.map((s) => s.slug).join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

for (const site of list) {
  const dir = path.join(OUT, site.slug);
  await mkdir(dir, { recursive: true });
  process.stdout.write(`→ ${site.slug} (${site.url})\n`);
  try {
    await shots(browser, site, dir, 'desktop');
    process.stdout.write('  captures ordinateur ✓\n');
    await shots(browser, site, dir, 'mobile');
    process.stdout.write('  captures téléphone ✓\n');
    await video(browser, site, dir);
    process.stdout.write('  vidéo ✓\n');
  } catch (err) {
    process.stdout.write(`  ✗ ${err.message}\n`);
  }
}

await browser.close();