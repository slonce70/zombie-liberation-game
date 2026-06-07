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
  createBattleSession,
  applyHeroAttack,
  applyEnemyCounterAttack,
  getBattleOutcome,
  resolveBattleVictory,
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

test('step combat starts with full hero and enemy HP without mutating campaign', () => {
  const state = createInitialState();
  const beforeCoins = state.coins;
  const beforeLevel = state.countries[0].currentLevel;

  const result = createBattleSession(state, 'artem', 'ukraine');

  assert.equal(result.created, true);
  assert.equal(result.session.fighterId, 'artem');
  assert.equal(result.session.countryId, 'ukraine');
  assert.equal(result.session.countryLevel, 1);
  assert.equal(result.session.heroAttackCount, 0);
  assert.equal(result.session.enemyCounterCount, 0);
  assert.equal(result.session.hero.currentHp, result.session.hero.maxHp);
  assert.equal(result.session.enemy.currentHp, result.session.enemy.maxHp);
  assert.equal(state.coins, beforeCoins);
  assert.equal(state.countries[0].currentLevel, beforeLevel);
});

test('first step attack only damages the enemy when damage is below enemy HP', () => {
  const state = createInitialState();
  const { session } = createBattleSession(state, 'artem', 'ukraine');

  const result = applyHeroAttack(session);

  assert.equal(result.damage, 34);
  assert.equal(result.session.heroAttackCount, 1);
  assert.equal(result.session.enemyCounterCount, 0);
  assert.equal(result.session.enemy.currentHp, 38);
  assert.equal(result.session.hero.currentHp, 135);
  assert.equal(getBattleOutcome(result.session), 'ongoing');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});

test('enemy counterattack only happens while enemy is alive and can defeat hero without campaign progress', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;
  session = {
    ...session,
    hero: { ...session.hero, currentHp: 5 },
    enemy: { ...session.enemy, currentHp: 38 },
  };

  const result = applyEnemyCounterAttack(session);

  assert.equal(result.damage, 11);
  assert.equal(result.session.heroAttackCount, 0);
  assert.equal(result.session.enemyCounterCount, 1);
  assert.equal(result.session.hero.currentHp, 0);
  assert.equal(result.session.enemy.currentHp, 38);
  assert.equal(getBattleOutcome(result.session), 'defeat');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});

test('enemy counterattack skip leaves provenance count unchanged', () => {
  const state = createInitialState();
  const baseSession = createBattleSession(state, 'artem', 'ukraine').session;
  const session = {
    ...baseSession,
    enemy: { ...baseSession.enemy, currentHp: 0 },
  };

  const result = applyEnemyCounterAttack(session);

  assert.equal(result.skipped, true);
  assert.equal(result.damage, 0);
  assert.equal(result.session.enemyCounterCount, 0);
});

test('step combat victory resolves the level exactly once', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;

  assert.equal(session.heroAttackCount, 3);
  assert.equal(session.enemy.currentHp, 0);
  assert.equal(getBattleOutcome(session), 'victory');

  const result = resolveBattleVictory(state, session, () => 0.99);
  assert.equal(result.completed, true);
  assert.equal(result.reward, 50);
  assert.equal(state.coins, 50);
  assert.equal(state.countries[0].currentLevel, 2);

  const duplicate = resolveBattleVictory(state, session, () => 0.99);
  assert.equal(duplicate.completed, false);
  assert.equal(duplicate.reason, 'stale_battle');
  assert.equal(state.coins, 50);
  assert.equal(state.countries[0].currentLevel, 2);
});

test('step combat rejects forged victory sessions without mutation', () => {
  const state = createInitialState();
  const validSession = createBattleSession(state, 'artem', 'ukraine').session;
  const forgedSession = {
    ...validSession,
    fighterId: 'sofia',
    fighterName: 'Софія Щит',
    enemy: { ...validSession.enemy, currentHp: 0 },
  };

  const result = resolveBattleVictory(state, forgedSession, () => 0.99);

  assert.equal(result.completed, false);
  assert.equal(result.reason, 'stale_battle');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});

test('step combat rejects forged unlocked-fighter victory sessions without mutation', () => {
  const state = createInitialState();
  const validSession = createBattleSession(state, 'artem', 'ukraine').session;
  const forgedSession = {
    ...validSession,
    enemy: { ...validSession.enemy, currentHp: 0 },
  };

  const result = resolveBattleVictory(state, forgedSession, () => 0.99);

  assert.equal(result.completed, false);
  assert.equal(result.reason, 'stale_battle');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});

test('step combat rejects invalid, locked, freed, and stale battles without mutation', () => {
  const state = createInitialState();
  const locked = createBattleSession(state, 'sofia', 'ukraine');
  const missing = createBattleSession(state, 'artem', 'missing-country');

  assert.equal(locked.created, false);
  assert.equal(locked.reason, 'invalid_battle');
  assert.equal(missing.created, false);
  assert.equal(missing.reason, 'invalid_battle');

  state.countries[0].freed = true;
  const freed = createBattleSession(state, 'artem', 'ukraine');
  assert.equal(freed.created, false);
  assert.equal(freed.reason, 'invalid_battle');
});
