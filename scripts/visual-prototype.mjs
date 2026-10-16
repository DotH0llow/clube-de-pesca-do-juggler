import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Captura estados reais do navegador depois de entradas de teclado/mouse.
 * A inspecao das imagens e obrigatoria; este roteiro nao certifica sozinho a arte.
 */
const url = process.argv[2] ?? 'http://127.0.0.1:5175/';
const out = resolve(process.argv[3] ?? 'visual-prototype-check');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 940 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const snap = async (name) => {
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  console.log(name);
};

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await snap('01-titulo');
  await page.getByRole('button', { name: /começar|continuar/i }).click();
  await page.waitForTimeout(1200);
  const daily = page.getByRole('button', { name: /pegar/i });
  if (await daily.isVisible().catch(() => false)) {
    await daily.click();
    await page.waitForTimeout(600);
  }
  await snap('02-praia-inicial');

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(5000);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(600);
  await snap('03-cais');
  await page.waitForTimeout(1400);
  await snap('04-cais-animado');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(6700);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  await snap('05-mercado');
  await page.keyboard.press('e');
  await page.waitForTimeout(600);
  await snap('06-interacao-mercado');

  console.log(`capturas: ${out}`);
  if (errors.length) console.error('Erros do navegador:', errors.join(' | '));
} finally {
  await browser.close();
}
