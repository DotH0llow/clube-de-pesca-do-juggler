import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5180/';
const out = resolve(process.argv[3] ?? 'visual-fishing-results');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1672, height: 940 } });
const snap = (name) => page.screenshot({ path: resolve(out, `${name}.png`) });
const visible = (selector) => page.locator(selector).isVisible().catch(() => false);

async function soltarTeclas() {
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']) await page.keyboard.up(key);
}

async function iniciarLance() {
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    const lancar = page.getByRole('button', {
      name: await visible('.catch-popup') ? /lançar de novo/i : /^lançar$/i,
    });
    await lancar.click();
    await page.waitForTimeout(180);
    await page.getByRole('button', { name: /^travar$/i }).click();
    await page.waitForTimeout(650);
    if (await visible('.hunt-hook')) return true;
    if (await visible('.catch-popup')) continue;
  }
  return false;
}

async function pos(selector) {
  return page.locator(selector).evaluateAll((nodes) => {
    const node = nodes[0];
    if (!node) return null;
    const n = node.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
    return n ? { x: Number(n[1]), y: Number(n[2]) } : null;
  });
}

async function perseguirPeixe() {
  let horizontal = '';
  let vertical = '';
  const setAxis = async (oldKey, newKey) => {
    if (oldKey === newKey) return oldKey;
    if (oldKey) await page.keyboard.up(oldKey);
    if (newKey) await page.keyboard.down(newKey);
    return newKey;
  };
  const fim = Date.now() + 14000;
  while (Date.now() < fim && await visible('.hunt-hook')) {
    const [hook, fish] = await Promise.all([pos('.hunt-hook'), pos('.hunt-fish')]);
    if (!hook || !fish) break;
    const dx = fish.x - hook.x;
    const dy = fish.y - hook.y;
    horizontal = await setAxis(horizontal, dx > 24 ? 'ArrowRight' : dx < -24 ? 'ArrowLeft' : '');
    vertical = await setAxis(vertical, dy > 24 ? 'ArrowDown' : dy < -24 ? 'ArrowUp' : '');
    await page.waitForTimeout(70);
  }
  await soltarTeclas();
}

async function recolherComTensao() {
  if (!(await visible('.reel'))) return;
  await snap('23-pesca-tensao-recolhimento');
  let segurando = false;
  const fim = Date.now() + 24000;
  while (Date.now() < fim && await visible('.reel')) {
    const [zone, fish] = await Promise.all([
      page.locator('.reel-zone').boundingBox(),
      page.locator('.reel-fish').boundingBox(),
    ]);
    if (!zone || !fish) break;
    const subir = zone.y + zone.height / 2 > fish.y + fish.height / 2;
    if (subir !== segurando) {
      segurando = subir;
      if (subir) await page.keyboard.down('Space');
      else await page.keyboard.up('Space');
    }
    await page.waitForTimeout(55);
  }
  await page.keyboard.up('Space');
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /começar|continuar/i }).click();
  await page.waitForTimeout(650);
  const daily = page.getByRole('button', { name: /pegar/i });
  if (await daily.isVisible().catch(() => false)) await daily.click();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(5000);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('e');
  await page.waitForTimeout(450);

  if (!await iniciarLance()) throw new Error('Nenhum encontro apareceu em seis lances.');
  await perseguirPeixe();
  await recolherComTensao();
  await page.waitForTimeout(450);
  await snap('24-pesca-resultado-primeiro-lance');

  const deNovo = page.getByRole('button', { name: /lançar de novo/i });
  if (await deNovo.isVisible().catch(() => false)) {
    if (await iniciarLance()) {
      await page.getByRole('button', { name: /recolher/i }).click();
      await page.waitForTimeout(450);
      await snap('25-pesca-resultado-peixe-escapou');
    }
  }
  console.log(`capturas: ${out}`);
} finally {
  await soltarTeclas();
  await browser.close();
}
