import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Percorre as telas do celular e o editor como um jogador, registrando
 * evidencia visual. As imagens ainda precisam ser inspecionadas por uma pessoa.
 */
const url = process.argv[2] ?? 'http://127.0.0.1:5180/';
const out = resolve(process.argv[3] ?? 'visual-panels-check');
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
  await page.getByRole('button', { name: /começar|continuar/i }).click();
  await page.waitForTimeout(900);
  const daily = page.getByRole('button', { name: /pegar/i });
  if (await daily.isVisible().catch(() => false)) {
    await daily.click();
    await page.waitForTimeout(500);
  }

  await page.getByRole('button', { name: /celular/i }).click();
  await page.waitForTimeout(350);
  await snap('08-celular-inicio');

  const apps = [
    ['album', /álbum/i],
    ['cais', /^cais$/i],
    ['cartela', /cartela/i],
    ['radio', /rádio/i],
    ['trofeus', /troféus/i],
    ['configuracoes', /^config$/i],
    ['como-jogar', /^ajuda$/i],
  ];
  let index = 9;
  for (const [slug, label] of apps) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForTimeout(250);
    await snap(`${String(index).padStart(2, '0')}-celular-${slug}`);
    index += 1;
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.waitForTimeout(180);
  }

  await page.getByRole('button', { name: /fechar/i }).click();
  await page.getByRole('button', { name: /editor/i }).click();
  await page.waitForTimeout(450);
  await snap('16-editor-mundo');

  console.log(`capturas: ${out}`);
  if (errors.length) {
    console.error('Erros do navegador:', errors.join(' | '));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
