import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  getLevelReward,
  openMegaBox,
  upgradeFighter,
  completeLevel,
  isBossUnlocked,
  getBattleStats,
  fightEnemy,
} from '../src/gameLogic.js';

test('level 1 victory rewards exactly 50 coins', () => {
  assert.equal(getLevelReward(1), 50);
});

test('mega box unlocks a locked fighter when roll is inside 56 percent chance', () => {
  const state = createInitialState();
  const result = openMegaBox(state, () => 0.55);
  assert.equal(result.unlocked, true);
  assert.equal(result.fighter.name, 'Софія Щит');
});

test('mega box does not unlock a fighter when roll is above 56 percent chance', () => {
  const state = createInitialState();
  const result = openMegaBox(state, () => 0.56);
  assert.equal(result.unlocked, false);
  assert.equal(state.fighters.filter((fighter) => fighter.unlocked).length, 1);
});

test('fighters upgrade with coins, gain stats, and stop at level 10', () => {
  const state = createInitialState();
  state.coins = 99999;
  const before = getBattleStats(state.fighters[0]);

  for (let i = 0; i < 12; i += 1) {
    upgradeFighter(state, 'artem');
  }

  const after = getBattleStats(state.fighters[0]);
  assert.equal(state.fighters[0].level, 10);
  assert.ok(after.hp > before.hp);
  assert.ok(after.damage > before.damage);
});

test('a country is marked freed after completing level 25', () => {
  const state = createInitialState();
  for (let i = 0; i < 25; i += 1) {
    completeLevel(state, 'ukraine');
  }

  const ukraine = state.countries.find((country) => country.id === 'ukraine');
  assert.equal(ukraine.currentLevel, 25);
  assert.equal(ukraine.freed, true);
});

test('final boss unlocks only after all five countries are freed', () => {
  const state = createInitialState();
  assert.equal(isBossUnlocked(state), false);

  for (const country of state.countries) {
    country.freed = true;
  }

  assert.equal(isBossUnlocked(state), true);
});

test('battle simulation lets a starter fighter beat the first zombie', () => {
  const state = createInitialState();
  const result = fightEnemy(state, 'artem', 'ukraine');
  assert.equal(result.victory, true);
  assert.equal(result.reward, 50);
  assert.equal(state.coins, 50);
});
