import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSpriteCatalog,
  getSpriteForEntity,
  spriteArtBible,
  spriteFrameContract,
  spriteStates,
  spriteStyleRules,
} from '../src/spriteCatalog.js';

test('sprite catalog defines hatch-pet-like states for every fighter and enemy type', () => {
  assert.deepEqual(spriteStates, ['idle', 'attack', 'hurt', 'victory']);
  assert.equal(getSpriteForEntity('artem').name, 'Артем Блискавка');
  assert.equal(getSpriteForEntity('zombie').states.idle.frames, 4);
  assert.equal(getSpriteForEntity('boss').states.attack.frames, 6);
});

test('sprite catalog exposes atlas and manifest paths for the adapted Hatch Pet pipeline', () => {
  const catalog = getSpriteCatalog();
  assert.equal(Object.keys(catalog).length, 7);
  for (const sprite of Object.values(catalog)) {
    assert.match(sprite.atlas, /spritesheet\.webp$/);
    assert.match(sprite.manifest, /manifest\.json$/);
    assert.equal(sprite.frameContract.cellSize, 192);
    assert.equal(sprite.frameContract.rows.attack.frames, 6);
    assert.equal(sprite.artBible, spriteArtBible.conceptPath);
  }
});

test('sprite art bible records the accepted ImageGen concept and generation docs', () => {
  assert.equal(spriteArtBible.conceptPath, 'assets/concept/zombie-liberation-art-bible-v2.png');
  assert.match(spriteArtBible.analysisPath, /imagegen-concept-analysis\.md$/);
  assert.match(spriteArtBible.pipelinePath, /hatch-pet-adapted-sprite-pipeline\.md$/);
  assert.match(spriteArtBible.promptsPath, /entity-imagegen-prompts\.md$/);
  assert.equal(spriteFrameContract.rows.idle.frames, 4);
  assert.equal(spriteFrameContract.rows.victory.frames, 4);
});

test('sprite style rules forbid unsafe or drift-prone generation details', () => {
  assert.match(spriteStyleRules.avoid, /blood|gore|horror|wounds|logos|realistic weapons|detached effects|guide marks/i);
  assert.match(spriteStyleRules.style, /kid-friendly/i);
  assert.match(spriteStyleRules.keep, /same identity/i);
});
