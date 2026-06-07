import test from 'node:test';
import assert from 'node:assert/strict';
import { countries, fighters, boss } from '../src/gameData.js';

const banned = /blood|gore|kill|murder|жах|кров|вбив/iu;

test('game data copy stays kid-friendly and non-gory', () => {
  const copy = [
    ...countries.map((country) => `${country.name} ${country.icon} ${country.chapter || ''}`),
    ...fighters.map((fighter) => `${fighter.name} ${fighter.role} ${fighter.unlockText}`),
    `${boss.name} ${boss.emoji}`,
  ].join(' ');

  assert.equal(banned.test(copy), false);
});
