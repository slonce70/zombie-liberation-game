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
