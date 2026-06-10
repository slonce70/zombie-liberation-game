import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  getLevelReward,
  getEnemyForLevel,
  createRewardChoice,
  applyRewardChoice,
  getEffectiveUpgradeCost,
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
  getEnemyArchetype,
  getFighterPassive,
} from '../src/gameLogic.js';

test('level 1 victory rewards exactly 50 coins', () => {
  assert.equal(getLevelReward(1), 50);
});

test('enemy archetypes are deterministic for country levels', () => {
  assert.equal(getEnemyArchetype(1).id, 'normal');
  assert.equal(getEnemyArchetype(2).id, 'fast');
  assert.equal(getEnemyArchetype(3).id, 'tank');
  assert.equal(getEnemyArchetype(4).id, 'armored');
  assert.equal(getEnemyArchetype(5).id, 'captain');
  assert.equal(getEnemyArchetype(10).id, 'captain');
});

test('captain archetype has priority over modulo archetypes', () => {
  assert.equal(getEnemyArchetype(20).id, 'captain');
});

test('getEnemyForLevel includes tactical archetype metadata and adjusted stats', () => {
  const levelOne = getEnemyForLevel(1);
  const fast = getEnemyForLevel(2);
  const tank = getEnemyForLevel(3);
  const armored = getEnemyForLevel(4);
  const captain = getEnemyForLevel(5);

  assert.equal(levelOne.archetypeId, 'normal');
  assert.equal(levelOne.hp, 72);
  assert.equal(levelOne.damage, 11);
  assert.equal(fast.archetypeId, 'fast');
  assert.equal(fast.hp, 69);
  assert.equal(fast.damage, 17);
  assert.equal(tank.archetypeId, 'tank');
  assert.equal(tank.hp, 135);
  assert.equal(tank.damage, 13);
  assert.equal(armored.archetypeId, 'armored');
  assert.equal(armored.hp, 125);
  assert.equal(armored.firstHitDamageMultiplier, 0.65);
  assert.equal(captain.archetypeId, 'captain');
  assert.equal(captain.hp, 186);
  assert.equal(captain.damage, 22);
});

test('fighter passives are available by fighter id', () => {
  assert.deepEqual(getFighterPassive('artem'), {
    id: 'spark_tempo',
    name: 'Іскровий темп',
    description: 'Кожен 3-й удар сильніший.',
  });
  assert.equal(getFighterPassive('missing'), null);
});

test('reward choice appears only on tactical reward levels and not on mega box level', () => {
  const state = createInitialState();

  assert.equal(createRewardChoice(state, 'ukraine', 1).created, false);
  assert.equal(createRewardChoice(state, 'ukraine', 3).created, true);
  assert.equal(createRewardChoice(state, 'ukraine', 7).created, true);
  assert.equal(createRewardChoice(state, 'ukraine', 10).created, false);
  assert.equal(createRewardChoice(state, 'ukraine', 13).created, true);
});

test('applying bonus coins reward works exactly once', () => {
  const state = createInitialState();
  createRewardChoice(state, 'ukraine', 3);

  const result = applyRewardChoice(state, 'bonus_coins');
  const duplicate = applyRewardChoice(state, 'bonus_coins');

  assert.equal(result.applied, true);
  assert.equal(result.message, 'Отримано +35 монет.');
  assert.equal(state.coins, 35);
  assert.equal(state.pendingRewardChoice, null);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.reason, 'no_pending_reward');
});

test('upgrade discount lowers the next successful upgrade cost and then clears', () => {
  const state = createInitialState();
  state.coins = 999;
  state.pendingRewardChoice = {
    countryId: 'ukraine',
    completedLevel: 3,
    options: [
      { id: 'upgrade_discount', label: 'Знижка прокачки', description: 'Наступна прокачка дешевша' },
      { id: 'bonus_coins', label: 'Більше монет', description: '+35 монет' },
    ],
  };

  const reward = applyRewardChoice(state, 'upgrade_discount');
  const cost = getEffectiveUpgradeCost(state, state.fighters[0].level);
  const upgrade = upgradeFighter(state, 'artem');

  assert.equal(reward.applied, true);
  assert.equal(cost, 78);
  assert.equal(upgrade.cost, 78);
  assert.equal(state.upgradeDiscountPercent, 0);
});

test('pity token reward never opens a fighter directly', () => {
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'ukraine',
    completedLevel: 13,
    options: [
      { id: 'pity_token', label: 'Жетон удачі', description: '+1 жетон удачі' },
      { id: 'bonus_coins', label: 'Більше монет', description: '+35 монет' },
    ],
  };

  const result = applyRewardChoice(state, 'pity_token');

  assert.equal(result.applied, true);
  assert.equal(state.pityTokens, 1);
  assert.equal(state.fighters.filter((fighter) => fighter.unlocked).length, 1);
});

test('complete level preserves an existing pending reward choice', () => {
  const state = createInitialState();
  const country = state.countries.find((item) => item.id === 'ukraine');
  country.currentLevel = 3;

  const firstResult = completeLevel(state, 'ukraine');
  const firstRewardChoice = state.pendingRewardChoice;
  country.currentLevel = 7;

  const secondResult = completeLevel(state, 'ukraine');

  assert.equal(firstResult.rewardChoice.completedLevel, 3);
  assert.strictEqual(state.pendingRewardChoice, firstRewardChoice);
  assert.equal(state.pendingRewardChoice.completedLevel, 3);
  assert.equal(secondResult.rewardChoice, null);
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
  const enemyDefeatedSession = {
    ...baseSession,
    enemy: { ...baseSession.enemy, currentHp: 0 },
  };
  const heroDefeatedSession = {
    ...baseSession,
    hero: { ...baseSession.hero, currentHp: 0 },
  };

  const enemyDefeatedResult = applyEnemyCounterAttack(enemyDefeatedSession);
  const heroDefeatedResult = applyEnemyCounterAttack(heroDefeatedSession);

  assert.equal(enemyDefeatedResult.skipped, true);
  assert.equal(enemyDefeatedResult.damage, 0);
  assert.equal(enemyDefeatedResult.session.enemyCounterCount, 0);
  assert.equal(heroDefeatedResult.skipped, true);
  assert.equal(heroDefeatedResult.damage, 0);
  assert.equal(heroDefeatedResult.session.enemyCounterCount, 0);
});

test('defeated hero cannot keep attacking or resolve victory', () => {
  const state = createInitialState();
  state.countries[0].currentLevel = 25;
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  while (getBattleOutcome(session) === 'ongoing') {
    session = applyHeroAttack(session).session;
    session = applyEnemyCounterAttack(session).session;
  }

  assert.equal(getBattleOutcome(session), 'defeat');
  const heroAttackCountAfterDefeat = session.heroAttackCount;
  const enemyHpAfterDefeat = session.enemy.currentHp;

  const skippedAttack = applyHeroAttack(session);

  assert.equal(skippedAttack.skipped, true);
  assert.equal(skippedAttack.damage, 0);
  assert.equal(skippedAttack.session.heroAttackCount, heroAttackCountAfterDefeat);
  assert.equal(skippedAttack.session.enemy.currentHp, enemyHpAfterDefeat);

  session = skippedAttack.session;
  for (let i = 0; i < 20; i += 1) {
    session = applyHeroAttack(session).session;
  }

  assert.equal(session.enemy.currentHp, enemyHpAfterDefeat);
  assert.equal(getBattleOutcome(session), 'defeat');

  const result = resolveBattleVictory(state, session, () => 0.99);
  assert.equal(result.completed, false);
  assert.equal(result.reason, 'stale_battle');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 25);
});

test('step combat victory resolves the level exactly once', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  session = applyHeroAttack(session).session;
  session = applyEnemyCounterAttack(session).session;
  session = applyHeroAttack(session).session;
  session = applyEnemyCounterAttack(session).session;
  session = applyHeroAttack(session).session;

  assert.equal(session.heroAttackCount, 3);
  assert.equal(session.enemyCounterCount, 2);
  assert.equal(session.enemy.currentHp, 0);
  assert.equal(getBattleOutcome(session), 'victory');

  session = { ...session, fighterName: 'Forged Winner' };
  const result = resolveBattleVictory(state, session, () => 0.99);
  assert.equal(result.completed, true);
  assert.equal(result.fighterName, 'Артем Блискавка');
  assert.equal(result.reward, 50);
  assert.equal(state.coins, 50);
  assert.equal(state.countries[0].currentLevel, 2);

  const duplicate = resolveBattleVictory(state, session, () => 0.99);
  assert.equal(duplicate.completed, false);
  assert.equal(duplicate.reason, 'stale_battle');
  assert.equal(state.coins, 50);
  assert.equal(state.countries[0].currentLevel, 2);
});

test('step combat rejects forged victory that skips required enemy counters', () => {
  const state = createInitialState();
  let forgedSession = createBattleSession(state, 'artem', 'ukraine').session;

  forgedSession = applyHeroAttack(forgedSession).session;
  forgedSession = applyHeroAttack(forgedSession).session;
  forgedSession = applyHeroAttack(forgedSession).session;

  assert.equal(forgedSession.heroAttackCount, 3);
  assert.equal(forgedSession.enemyCounterCount, 0);
  assert.equal(getBattleOutcome(forgedSession), 'victory');

  const result = resolveBattleVictory(state, forgedSession, () => 0.99);

  assert.equal(result.completed, false);
  assert.equal(result.reason, 'stale_battle');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
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
