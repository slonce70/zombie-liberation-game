import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryStorage,
  loadGame,
  saveGame,
  resetGame,
  SAVE_KEY,
  SAVE_VERSION,
} from '../src/saveSystem.js';
import { createInitialState, completeLevel, upgradeFighter } from '../src/gameLogic.js';

test('saveGame and loadGame preserve coins, countries, fighters, pity tokens, and boss state', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.coins = 999;
  state.pityTokens = 1;
  completeLevel(state, 'ukraine', () => 0.99);
  upgradeFighter(state, 'artem');
  state.bossDefeated = true;

  saveGame(storage, state);
  const loaded = loadGame(storage);

  assert.equal(storage.getItem(SAVE_KEY).includes(`"version":${SAVE_VERSION}`), true);
  assert.equal(loaded.coins, state.coins);
  assert.equal(loaded.pityTokens, 1);
  assert.equal(loaded.countries[0].currentLevel, 2);
  assert.equal(loaded.fighters[0].level, 2);
  assert.equal(loaded.bossDefeated, true);
});

test('loadGame returns a fresh initial state when save data is corrupted', () => {
  const storage = createMemoryStorage();
  storage.setItem(SAVE_KEY, '{broken json');

  const loaded = loadGame(storage);

  assert.equal(loaded.coins, 0);
  assert.equal(loaded.selectedCountryId, 'ukraine');
  assert.equal(loaded.selectedFighterId, 'artem');
});

test('resetGame removes saved progress and returns initial state', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.coins = 500;
  saveGame(storage, state);

  const reset = resetGame(storage);

  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(reset.coins, 0);
});

test('new tactical fields default on a fresh game', () => {
  const storage = createMemoryStorage();

  const loaded = loadGame(storage);

  assert.equal(loaded.pendingRewardChoice, null);
  assert.equal(loaded.upgradeDiscountPercent, 0);
  assert.equal(loaded.nextBattleBuff, null);
});

test('old saves without tactical fields hydrate with backward-compatible defaults', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  delete state.pendingRewardChoice;
  delete state.upgradeDiscountPercent;
  delete state.nextBattleBuff;
  storage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    savedAt: '2026-06-10T00:00:00.000Z',
    state,
  }));

  const loaded = loadGame(storage);

  assert.equal(loaded.pendingRewardChoice, null);
  assert.equal(loaded.upgradeDiscountPercent, 0);
  assert.equal(loaded.nextBattleBuff, null);
  assert.equal(loaded.selectedCountryId, 'ukraine');
  assert.equal(loaded.selectedFighterId, 'artem');
});

test('invalid tactical save fields are clamped or ignored', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'missing-country',
    completedLevel: 999,
    options: [{ id: 'bad-option', label: '<script>', description: 'bad' }],
  };
  state.upgradeDiscountPercent = 999;
  state.nextBattleBuff = { type: 'speed', percent: 500 };
  storage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    savedAt: '2026-06-10T00:00:00.000Z',
    state,
  }));

  const loaded = loadGame(storage);

  assert.equal(loaded.pendingRewardChoice, null);
  assert.equal(loaded.upgradeDiscountPercent, 0);
  assert.equal(loaded.nextBattleBuff, null);
});

test('valid tactical save fields are preserved', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'ukraine',
    completedLevel: 3,
    options: [
      { id: 'bonus_coins', label: 'Більше монет', description: '+35 монет' },
      { id: 'upgrade_discount', label: 'Знижка прокачки', description: 'Наступна прокачка дешевша' },
    ],
  };
  state.upgradeDiscountPercent = 25;
  state.nextBattleBuff = { type: 'damage', percent: 10 };

  saveGame(storage, state);
  const loaded = loadGame(storage);

  assert.deepEqual(loaded.pendingRewardChoice, state.pendingRewardChoice);
  assert.equal(loaded.upgradeDiscountPercent, 25);
  assert.deepEqual(loaded.nextBattleBuff, { type: 'damage', percent: 10 });
});
