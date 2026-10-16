import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Move uma entidade pelo editor e confirma que o runtime usa a mesma posicao.
 * O contexto e descartavel: nenhuma personalizacao do jogador e alterada.
 */
const url = process.argv[2] ?? 'http://127.0.0.1:5180/';
const out = resolve(process.argv[3] ?? 'visual-editor-sync-check');
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

  const bench = page.locator('[data-obj="prototype-bench"]');
  const before = Number(await bench.evaluate((node) => parseFloat(node.style.left)));
  await page.getByRole('button', { name: /editor/i }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /^OBJETOS/i }).click();
  await page.waitForTimeout(120);

  const box = await bench.boundingBox();
  if (!box) throw new Error('Banco do prototipo nao apareceu no editor.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 76, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const selectedName = await page.locator('.einspect .eline').first().textContent();
  if (!selectedName?.includes('pier-bench-side')) {
    throw new Error(`Editor selecionou o objeto errado: ${selectedName ?? 'nenhum'}.`);
  }
  await page.screenshot({ path: resolve(out, '26-editor-entidade-reposicionada.png') });

  await page.getByRole('button', { name: /sair do editor/i }).evaluate((button) => button.click());
  await page.waitForTimeout(300);
  await page.locator('.editor').waitFor({ state: 'detached' });
  const after = Number(await bench.evaluate((node) => parseFloat(node.style.left)));
  if (!(after > before + 40)) {
    throw new Error(`Editor nao sincronizou a entidade: antes=${before}, depois=${after}.`);
  }
  await page.screenshot({ path: resolve(out, '27-runtime-entidade-sincronizada.png') });
  console.log(`entidade sincronizada: ${before} -> ${after}`);

  const startTransform = await page.locator('.player').evaluate((node) => node.style.transform);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(12000);
  const xAtWall = await page.locator('.player').evaluate((node) => node.style.transform);
  await page.waitForTimeout(2200);
  await page.keyboard.up('ArrowRight');
  const xAfterWall = await page.locator('.player').evaluate((node) => node.style.transform);
  if (xAtWall === startTransform) {
    throw new Error(`Jogador nao se moveu para testar a parede: ${startTransform}.`);
  }
  if (xAtWall !== xAfterWall) {
    throw new Error(`Parede leste nao conteve o jogador: ${xAtWall} -> ${xAfterWall}.`);
  }
  await page.screenshot({ path: resolve(out, '28-limite-leste-colisao.png') });
  console.log(`limite leste preservado: ${xAfterWall}`);

  if (errors.length) {
    console.error('Erros do navegador:', errors.join(' | '));
    process.exitCode = 1;
  }
} finally {
  await page.keyboard.up('ArrowRight').catch(() => {});
  await browser.close();
}
