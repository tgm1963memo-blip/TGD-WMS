// Regenerates the PNG app icons from public/icons/icon.svg. Run after changing
// the SVG: node scripts/generate-pwa-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const ICON_DIR = 'public/icons';
const NAVY = '#09111c';
const svg = readFileSync(`${ICON_DIR}/icon.svg`, 'utf8');

// `scale` keeps the mark inside the circle Android may crop a maskable icon
// to. `square` drops the rounded corners: the OS applies its own mask, and
// iOS would fill transparent corners with black.
const ICONS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, square: true, scale: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, square: true },
];

const browser = await chromium.launch();
for (const { file, size, square = false, scale = 1 } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const markup = square ? svg.replace(' rx="20"', '') : svg;
  await page.setContent(`<!doctype html><style>
    html, body { margin: 0; width: 100%; height: 100%; background: ${square ? NAVY : 'transparent'}; }
    body { display: flex; align-items: center; justify-content: center; }
    svg { width: ${scale * 100}%; height: ${scale * 100}%; display: block; }
  </style>${markup}`);
  await page.screenshot({ path: `${ICON_DIR}/${file}`, omitBackground: !square });
  await page.close();
}
await browser.close();
