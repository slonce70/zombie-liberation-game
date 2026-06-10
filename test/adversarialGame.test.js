import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  createBattleSession,
  applyHeroAttack,
  applyRewardChoice,
  openMegaBox,
  upgradeFighter,
  fightEnemy,
  fightBoss,
  selectFighter,
  selectCountry,
  isBossUnlocked,
  resolveBattleVictory,
} from '../src/gameLogic.js';

test('invalid country and locked fighter battles are rejected without changing coins', () => {
  const state = createInitialState();
  const beforeCoins = state.coins;
  const invalidCountry = fightEnemy(state, 'artem', 'missing-country');
  const lockedFighter = fightEnemy(state, 'sofia', 'ukraine');

  assert.equal(invalidCountry.victory, false);
  assert.equal(lockedFighter.victory, false);
  assert.equal(state.coins, beforeCoins);
});

test('upgrade refuses insufficient coins and keeps fighter level stable', () => {
  const state = createInitialState();
  const beforeLevel = state.fighters[0].level;
  const result = upgradeFighter(state, 'artem');

  assert.equal(result.upgraded, false);
  assert.equal(result.reason, 'not_enough_coins');
  assert.equal(state.fighters[0].level, beforeLevel);
});

test('mega box reports all fighters already unlocked without mutating roster', () => {
  const state = createInitialState();
  state.fighters.forEach((fighter) => { fighter.unlocked = true; });
  const result = openMegaBox(state, () => 0);

  assert.equal(result.unlocked, false);
  assert.equal(result.fighter, null);
  assert.equal(state.fighters.every((fighter) => fighter.unlocked), true);
});

test('boss battle stays locked until every country is freed', () => {
  const state = createInitialState();
  state.countries.slice(0, 4).forEach((country) => { country.freed = true; });

  assert.equal(isBossUnlocked(state), false);
  assert.equal(fightBoss(state, 'artem').reason, 'countries_remaining');
});

test('select helpers ignore malformed ids and preserve current selections', () => {
  const state = createInitialState();
  selectCountry(state, 'not-a-country');
  selectFighter(state, 'not-a-fighter');

  assert.equal(state.selectedCountryId, 'ukraine');
  assert.equal(state.selectedFighterId, 'artem');
});

test('repeated unlucky mega boxes still unlock fighters through pity tokens so boss path is not soft-locked', () => {
  const state = createInitialState();

  const box1 = openMegaBox(state, () => 0.99);
  const box2 = openMegaBox(state, () => 0.99);
  const box3 = openMegaBox(state, () => 0.99);
  const box4 = openMegaBox(state, () => 0.99);
  const box5 = openMegaBox(state, () => 0.99);

  assert.equal(box1.unlocked, false);
  assert.equal(box2.unlocked, true);
  assert.equal(box2.reason, 'pity');
  assert.equal(box3.unlocked, false);
  assert.equal(box4.unlocked, true);
  assert.equal(box4.reason, 'pity');
  assert.equal(box5.unlocked, false);
  assert.equal(state.fighters.filter((fighter) => fighter.unlocked).length, 3);

  state.fighters.filter((fighter) => fighter.unlocked).forEach((fighter) => { fighter.level = 10; });
  state.countries.forEach((country) => { country.freed = true; });

  assert.equal(fightBoss(state, 'artem').victory, true);
});

test('reward choice cannot be applied with a forged option id', () => {
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'ukraine',
    completedLevel: 3,
    options: [
      { id: 'bonus_coins', label: 'Більше монет', description: '+35 монет' },
      { id: 'upgrade_discount', label: 'Знижка прокачки', description: 'Наступна прокачка дешевша' },
    ],
  };

  const result = applyRewardChoice(state, 'unlock_all_fighters');

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'reward_unavailable');
  assert.equal(state.coins, 0);
  assert.equal(state.pendingRewardChoice.options.length, 2);
});

test('forged passive victory that skips enemy counters is rejected', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;
  session = {
    ...session,
    enemy: { ...session.enemy, currentHp: 0 },
    enemyCounterCount: 0,
  };

  const result = resolveBattleVictory(state, session, () => 0.99);

  assert.equal(result.completed, false);
  assert.equal(result.reason, 'stale_battle');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});
