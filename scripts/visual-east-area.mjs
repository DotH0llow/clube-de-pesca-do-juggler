import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Captura a cabana e a borda leste depois de atravessar a praia jogando. */
const url = process.argv[2] ?? 'http://127.0.0.1:5180/';
const out = resolve(process.argv[3] ?? 'visual-east-check');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 940 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /começar|continuar/i }).click();
  await page.waitForTimeout(900);
  const daily = page.getByRole('button', { name: /pegar/i });
  if (await daily.isVisible().catch(() => false)) await daily.click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(9400);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(out, '17-cabana-e-arcade.png') });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(out, '18-cabana-ambiente-animado.png') });
  console.log(`capturas: ${out}`);
  if (errors.length) {
    console.error('Erros do navegador:', errors.join(' | '));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
