import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5180/';
const out = resolve(process.argv[3] ?? 'visual-fishing-check');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 940 } });
const snap = (name) => page.screenshot({ path: resolve(out, `${name}.png`) });

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /começar|continuar/i }).click();
  await page.waitForTimeout(700);
  const daily = page.getByRole('button', { name: /pegar/i });
  if (await daily.isVisible().catch(() => false)) await daily.click();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(5000);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  await snap('19-pesca-pronto-para-lancar');

  await page.getByRole('button', { name: /^lançar$/i }).click();
  await page.waitForTimeout(220);
  await snap('20-pesca-forca-do-lancamento');
  await page.getByRole('button', { name: /^travar$/i }).click();
  await page.waitForTimeout(100);
  await snap('21-pesca-arremesso');
  await page.waitForTimeout(520);
  await snap('22-pesca-aguardando-fisgada');
  console.log(await page.getByRole('button').allTextContents());
} finally {
  await browser.close();
}
