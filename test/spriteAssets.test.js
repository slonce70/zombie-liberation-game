import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { getSpriteCatalog, spriteFrameContract, spriteStates } from '../src/spriteCatalog.js';

const expectedFrames = { idle: 4, attack: 6, hurt: 4, victory: 4 };

async function exists(path) {
  const info = await stat(path);
  assert.ok(info.size > 1000, `${path} should be a real generated asset`);
}

test('all seven entities have generated spritesheets, manifests, contact sheets, and GIF previews', async () => {
  const catalog = getSpriteCatalog();
  assert.equal(Object.keys(catalog).length, 7);

  for (const sprite of Object.values(catalog)) {
    const root = `assets/sprites/${sprite.group}/${sprite.id}`;
    await exists(`${root}/base.png`);
    await exists(`${root}/spritesheet.webp`);
    await exists(`${root}/manifest.json`);
    await exists(`${root}/qa/contact-sheet.png`);

    const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
    assert.equal(manifest.contract, 'zombie-liberation-hatch-pet-v1');
    assert.equal(manifest.cellSize, spriteFrameContract.cellSize);
    assert.equal(manifest.columns, spriteFrameContract.maxColumns);

    const webpMagic = await readFile(`${root}/spritesheet.webp`);
    assert.equal(webpMagic.subarray(0, 4).toString(), 'RIFF');
    assert.equal(webpMagic.subarray(8, 12).toString(), 'WEBP');

    for (const state of spriteStates) {
      await exists(`${root}/source/${state}-strip.png`);
      await exists(`${root}/qa/previews/${state}.gif`);
      const gifMagic = await readFile(`${root}/qa/previews/${state}.gif`);
      assert.equal(gifMagic.subarray(0, 6).toString(), 'GIF89a');
      assert.equal(manifest.states[state].frames, expectedFrames[state]);
      assert.equal(sprite.states[state].frames, expectedFrames[state]);
    }
  }
});
