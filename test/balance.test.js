import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  fightBoss,
  openMegaBox,
  upgradeFighter,
  isBossUnlocked,
} from '../src/gameLogic.js';

test('worst-case five country boxes unlock enough fighters for final boss after upgrades', () => {
  const state = createInitialState();
  for (let i = 0; i < 5; i += 1) openMegaBox(state, () => 0.99);
  state.fighters.filter((fighter) => fighter.unlocked).forEach((fighter) => { fighter.level = 10; });
  state.countries.forEach((country) => { country.freed = true; });

  assert.equal(isBossUnlocked(state), true);
  assert.equal(state.fighters.filter((fighter) => fighter.unlocked).length >= 3, true);
  assert.equal(fightBoss(state, 'artem').victory, true);
});

test('upgrade cost curve lets a player upgrade starter after several early wins', () => {
  const state = createInitialState();
  state.coins = 50 + 58 + 66;

  const result = upgradeFighter(state, 'artem');

  assert.equal(result.upgraded, true);
  assert.equal(state.fighters[0].level, 2);
});
