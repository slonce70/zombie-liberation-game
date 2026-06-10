import {
  boss,
  countries as countryData,
  enemyArchetypes,
  fighterPassives,
  fighters as fighterData,
  LEVELS_PER_COUNTRY,
  MAX_FIGHTER_LEVEL,
  MEGA_BOX_LEVEL,
  MEGA_BOX_UNLOCK_CHANCE,
  PITY_TOKENS_FOR_UNLOCK,
  rewardDefinitions,
  SPECIAL_REWARD_LEVELS,
} from './gameData.js';

export function createInitialState() {
  return {
    coins: 0,
    pityTokens: 0,
    pendingRewardChoice: null,
    upgradeDiscountPercent: 0,
    nextBattleBuff: null,
    selectedCountryId: countryData[0].id,
    selectedFighterId: fighterData[0].id,
    bossDefeated: false,
    countries: countryData.map((country) => ({
      ...country,
      currentLevel: 1,
      freed: false,
      megaBoxClaimed: false,
    })),
    fighters: fighterData.map((fighter, index) => ({
      ...fighter,
      level: 1,
      unlocked: index === 0,
    })),
    log: ['Артем Блискавка починає пригоду! Звільни 5 країн від веселих зомбі.'],
  };
}

export function getLevelReward(level) {
  return 50 + Math.max(0, level - 1) * 8;
}

export function getUpgradeCost(fighterLevel) {
  if (fighterLevel >= MAX_FIGHTER_LEVEL) return Infinity;
  return 70 + fighterLevel * 35;
}

export function getBattleStats(fighter) {
  const level = Math.min(fighter.level, MAX_FIGHTER_LEVEL);
  return {
    hp: fighter.baseHp + (level - 1) * fighter.hpPerLevel,
    damage: fighter.baseDamage + (level - 1) * fighter.damagePerLevel,
  };
}

function scaleStat(value, multiplier, rounding = Math.round) {
  return Math.max(1, rounding(value * multiplier));
}

function scaleDamage(value, multiplier) {
  const rounding = multiplier >= 1 ? Math.ceil : Math.floor;
  return scaleStat(value, multiplier, rounding);
}

export function getEnemyArchetype(level) {
  if (level % 5 === 0) return enemyArchetypes.captain;
  if (level % 4 === 2) return enemyArchetypes.fast;
  if (level % 4 === 3) return enemyArchetypes.tank;
  if (level % 4 === 0) return enemyArchetypes.armored;
  return enemyArchetypes.normal;
}

export function getFighterPassive(fighterId) {
  return fighterPassives[fighterId] || null;
}

export function getEnemyForLevel(level) {
  const archetype = getEnemyArchetype(level);
  const baseHp = 72 + (level - 1) * 14;
  const baseDamage = 10 + Math.floor(level * 1.8);
  const isCountryFinal = level >= LEVELS_PER_COUNTRY;
  return {
    name: isCountryFinal ? 'Капітан веселих зомбі' : `${archetype.name} рівня ${level}`,
    hp: scaleStat(baseHp, archetype.hpMultiplier),
    damage: scaleDamage(baseDamage, archetype.damageMultiplier),
    emoji: isCountryFinal ? '🧟‍♀️' : '🧟',
    archetypeId: archetype.id,
    archetypeName: archetype.name,
    traitText: archetype.traitText,
    firstHitDamageMultiplier: archetype.firstHitDamageMultiplier || 1,
  };
}

export function findCountry(state, countryId) {
  return state.countries.find((country) => country.id === countryId);
}

export function findFighter(state, fighterId) {
  return state.fighters.find((fighter) => fighter.id === fighterId);
}

export function openMegaBox(state, random = Math.random) {
  const locked = state.fighters.filter((fighter) => !fighter.unlocked);
  if (locked.length === 0) {
    return { unlocked: false, fighter: null, message: 'Усі бійці вже в команді!' };
  }

  const unlockFighter = (reason, roll = null) => {
    const fighter = locked[0];
    fighter.unlocked = true;
    state.pityTokens = 0;
    return {
      unlocked: true,
      fighter,
      roll,
      reason,
      message: reason === 'pity'
        ? `Два жетони удачі відкрили нового бійця: ${fighter.name}!`
        : `Мегабокс відкрив нового бійця: ${fighter.name}!`,
    };
  };

  const roll = random();
  if (roll < MEGA_BOX_UNLOCK_CHANCE) return unlockFighter('chance', roll);

  state.pityTokens += 1;
  if (state.pityTokens >= PITY_TOKENS_FOR_UNLOCK) return unlockFighter('pity', roll);

  return {
    unlocked: false,
    fighter: null,
    roll,
    pityTokens: state.pityTokens,
    consolationCoins: 35,
    message: `Мегабокс дав 35 монет і жетон удачі ${state.pityTokens}/${PITY_TOKENS_FOR_UNLOCK}.`,
  };
}

function cloneRewardDefinition(rewardId) {
  const reward = rewardDefinitions[rewardId];
  return reward ? { ...reward } : null;
}

function rewardIdsForLevel(state, completedLevel) {
  const byLevel = {
    3: ['bonus_coins', 'upgrade_discount'],
    7: ['next_damage', 'bonus_coins'],
    13: ['pity_token', 'upgrade_discount'],
    18: ['next_hp', 'bonus_coins'],
    23: ['pity_token', 'next_damage'],
  };
  const ids = byLevel[completedLevel] || [];
  return ids.map((id) => {
    if (id === 'pity_token' && state.pityTokens >= PITY_TOKENS_FOR_UNLOCK - 1) return 'bonus_coins';
    return id;
  });
}

export function createRewardChoice(state, countryId, completedLevel) {
  if (!SPECIAL_REWARD_LEVELS.includes(completedLevel) || completedLevel === MEGA_BOX_LEVEL) {
    return { created: false, reason: 'not_reward_level' };
  }
  const country = findCountry(state, countryId);
  if (!country) return { created: false, reason: 'country_unavailable' };
  const options = rewardIdsForLevel(state, completedLevel)
    .map(cloneRewardDefinition)
    .filter(Boolean);
  const uniqueOptions = options.filter((option, index, list) => (
    list.findIndex((item) => item.id === option.id) === index
  ));
  while (uniqueOptions.length < 2) {
    const fallback = cloneRewardDefinition(uniqueOptions.some((option) => option.id === 'bonus_coins')
      ? 'upgrade_discount'
      : 'bonus_coins');
    uniqueOptions.push(fallback);
  }
  state.pendingRewardChoice = {
    countryId,
    completedLevel,
    options: uniqueOptions.slice(0, 2),
  };
  return { created: true, rewardChoice: state.pendingRewardChoice };
}

export function getEffectiveUpgradeCost(state, fighterLevel) {
  const baseCost = getUpgradeCost(fighterLevel);
  if (!Number.isFinite(baseCost)) return baseCost;
  if (state.upgradeDiscountPercent !== 25) return baseCost;
  return Math.max(1, Math.floor(baseCost * 0.75));
}

export function applyRewardChoice(state, rewardId) {
  const pending = state.pendingRewardChoice;
  if (!pending) return { applied: false, reason: 'no_pending_reward' };
  const option = pending.options.find((item) => item.id === rewardId);
  if (!option) return { applied: false, reason: 'reward_unavailable' };

  if (rewardId === 'bonus_coins') {
    state.coins += 35;
    state.pendingRewardChoice = null;
    return { applied: true, rewardId, message: 'Отримано +35 монет.' };
  }
  if (rewardId === 'upgrade_discount') {
    state.upgradeDiscountPercent = 25;
    state.pendingRewardChoice = null;
    return { applied: true, rewardId, message: 'Наступна прокачка дешевша на 25%.' };
  }
  if (rewardId === 'pity_token') {
    state.pityTokens = Math.min(PITY_TOKENS_FOR_UNLOCK - 1, state.pityTokens + 1);
    state.pendingRewardChoice = null;
    return { applied: true, rewardId, message: `Жетон удачі ${state.pityTokens}/${PITY_TOKENS_FOR_UNLOCK}.` };
  }
  if (rewardId === 'next_damage') {
    state.nextBattleBuff = { type: 'damage', percent: 10 };
    state.pendingRewardChoice = null;
    return { applied: true, rewardId, message: 'Наступний бій почнеться з +10% урону.' };
  }
  if (rewardId === 'next_hp') {
    state.nextBattleBuff = { type: 'hp', percent: 10 };
    state.pendingRewardChoice = null;
    return { applied: true, rewardId, message: 'Наступний бій почнеться з +10% HP.' };
  }
  return { applied: false, reason: 'reward_unavailable' };
}

export function upgradeFighter(state, fighterId) {
  const fighter = findFighter(state, fighterId);
  if (!fighter || !fighter.unlocked) return { upgraded: false, reason: 'fighter_locked' };
  if (fighter.level >= MAX_FIGHTER_LEVEL) return { upgraded: false, reason: 'max_level' };

  const cost = getEffectiveUpgradeCost(state, fighter.level);
  if (state.coins < cost) return { upgraded: false, reason: 'not_enough_coins', cost };

  state.coins -= cost;
  fighter.level += 1;
  state.upgradeDiscountPercent = 0;
  return { upgraded: true, fighter, cost, stats: getBattleStats(fighter) };
}

export function completeLevel(state, countryId, random = Math.random) {
  const country = findCountry(state, countryId);
  if (!country || country.freed) return { completed: false, reason: 'country_unavailable' };

  const completedLevel = country.currentLevel;
  const reward = getLevelReward(completedLevel);
  state.coins += reward;

  let boxResult = null;
  if (completedLevel === MEGA_BOX_LEVEL && !country.megaBoxClaimed) {
    country.megaBoxClaimed = true;
    boxResult = openMegaBox(state, random);
    if (!boxResult.unlocked && boxResult.consolationCoins) {
      state.coins += boxResult.consolationCoins;
    }
  }

  const rewardChoice = createRewardChoice(state, country.id, completedLevel);

  if (completedLevel >= LEVELS_PER_COUNTRY) {
    country.currentLevel = LEVELS_PER_COUNTRY;
    country.freed = true;
  } else {
    country.currentLevel += 1;
  }

  return {
    completed: true,
    completedLevel,
    reward,
    boxResult,
    rewardChoice: rewardChoice.created ? rewardChoice.rewardChoice : null,
    country,
  };
}

export function fightEnemy(state, fighterId, countryId, random = Math.random) {
  const fighter = findFighter(state, fighterId);
  const country = findCountry(state, countryId);
  if (!fighter || !fighter.unlocked || !country || country.freed) {
    return { victory: false, reason: 'invalid_battle' };
  }

  const stats = getBattleStats(fighter);
  const enemy = getEnemyForLevel(country.currentLevel);
  const heroTurns = Math.ceil(enemy.hp / stats.damage);
  const enemyTurns = Math.ceil(stats.hp / enemy.damage);
  const victory = heroTurns <= enemyTurns;

  if (!victory) {
    return { victory: false, fighter, country, enemy, stats, reason: 'need_upgrade' };
  }

  const progress = completeLevel(state, countryId, random);
  return { victory: true, fighter, country, enemy, stats, reward: progress.reward, progress };
}

function clampHp(value, maxHp) {
  return Math.min(maxHp, Math.max(0, value));
}

function copyBattleSession(session) {
  return {
    ...session,
    hero: { ...session.hero },
    enemy: { ...session.enemy },
  };
}

export function createBattleSession(state, fighterId, countryId) {
  const fighter = findFighter(state, fighterId);
  const country = findCountry(state, countryId);
  if (!fighter || !fighter.unlocked || !country || country.freed) {
    return { created: false, reason: 'invalid_battle' };
  }

  const stats = getBattleStats(fighter);
  const enemy = getEnemyForLevel(country.currentLevel);
  return {
    created: true,
    session: {
      fighterId: fighter.id,
      fighterName: fighter.name,
      countryId: country.id,
      countryLevel: country.currentLevel,
      heroAttackCount: 0,
      enemyCounterCount: 0,
      hero: {
        currentHp: stats.hp,
        maxHp: stats.hp,
        damage: stats.damage,
      },
      enemy: {
        name: enemy.name,
        emoji: enemy.emoji,
        currentHp: enemy.hp,
        maxHp: enemy.hp,
        damage: enemy.damage,
      },
    },
  };
}

export function applyHeroAttack(session) {
  const next = copyBattleSession(session);
  if (next.hero.currentHp <= 0 || next.enemy.currentHp <= 0) {
    return { session: next, damage: 0, target: 'enemy', skipped: true };
  }

  const damage = Math.max(0, next.hero.damage);
  next.enemy.currentHp = clampHp(next.enemy.currentHp - damage, next.enemy.maxHp);
  next.heroAttackCount = (next.heroAttackCount ?? 0) + 1;
  return { session: next, damage, target: 'enemy' };
}

export function applyEnemyCounterAttack(session) {
  const next = copyBattleSession(session);
  if (next.enemy.currentHp <= 0 || next.hero.currentHp <= 0) {
    return { session: next, damage: 0, target: 'hero', skipped: true };
  }

  const damage = Math.max(0, next.enemy.damage);
  next.hero.currentHp = clampHp(next.hero.currentHp - damage, next.hero.maxHp);
  next.enemyCounterCount = (next.enemyCounterCount ?? 0) + 1;
  return { session: next, damage, target: 'hero' };
}

export function getBattleOutcome(session) {
  if (!session) return 'idle';
  if (session.hero.currentHp <= 0) return 'defeat';
  if (session.enemy.currentHp <= 0) return 'victory';
  return 'ongoing';
}

export function resolveBattleVictory(state, session, random = Math.random) {
  const country = findCountry(state, session?.countryId);
  const fighter = findFighter(state, session?.fighterId);
  if (
    !session
    || !fighter
    || !fighter.unlocked
    || !country
    || country.freed
    || country.currentLevel !== session.countryLevel
    || !session.hero
    || !session.enemy
    || session.hero.currentHp <= 0
    || getBattleOutcome(session) !== 'victory'
  ) {
    return { completed: false, reason: 'stale_battle' };
  }

  const stats = getBattleStats(fighter);
  const enemy = getEnemyForLevel(country.currentLevel);
  const heroAttackCount = session.heroAttackCount;
  const enemyCounterCount = session.enemyCounterCount;
  const expectedHeroAttackCount = session.hero.damage > 0
    ? Math.ceil(session.enemy.maxHp / session.hero.damage)
    : null;
  const expectedEnemyCounterCount = expectedHeroAttackCount === null
    ? null
    : expectedHeroAttackCount - 1;
  const expectedEnemyHp = Number.isInteger(heroAttackCount)
    ? clampHp(session.enemy.maxHp - session.hero.damage * heroAttackCount, session.enemy.maxHp)
    : null;
  const expectedHeroHp = Number.isInteger(enemyCounterCount)
    ? clampHp(session.hero.maxHp - session.enemy.damage * enemyCounterCount, session.hero.maxHp)
    : null;
  if (
    session.hero.maxHp !== stats.hp
    || session.hero.damage !== stats.damage
    || session.enemy.name !== enemy.name
    || session.enemy.emoji !== enemy.emoji
    || session.enemy.maxHp !== enemy.hp
    || session.enemy.damage !== enemy.damage
    || !Number.isInteger(heroAttackCount)
    || heroAttackCount !== expectedHeroAttackCount
    || session.enemy.currentHp !== expectedEnemyHp
    || !Number.isInteger(enemyCounterCount)
    || enemyCounterCount !== expectedEnemyCounterCount
    || session.hero.currentHp !== expectedHeroHp
  ) {
    return { completed: false, reason: 'stale_battle' };
  }

  const progress = completeLevel(state, session.countryId, random);
  if (!progress.completed) return { completed: false, reason: progress.reason };

  return {
    completed: true,
    fighterName: fighter.name,
    enemy: session.enemy,
    reward: progress.reward,
    progress,
  };
}

export function isBossUnlocked(state) {
  return state.countries.every((country) => country.freed);
}

export function fightBoss(state, fighterId) {
  if (!isBossUnlocked(state)) return { victory: false, reason: 'countries_remaining' };
  const fighter = findFighter(state, fighterId);
  if (!fighter?.unlocked) return { victory: false, reason: 'fighter_locked' };

  const stats = getBattleStats(fighter);
  const teamPower = state.fighters
    .filter((member) => member.unlocked)
    .reduce((sum, member) => sum + getBattleStats(member).damage + Math.floor(getBattleStats(member).hp / 10), 0);
  const victory = teamPower + stats.damage >= boss.hp / 3;
  if (victory) state.bossDefeated = true;
  return { victory, boss, teamPower, stats, reason: victory ? 'boss_defeated' : 'team_needs_upgrades' };
}

export function selectCountry(state, countryId) {
  if (findCountry(state, countryId)) state.selectedCountryId = countryId;
}

export function selectFighter(state, fighterId) {
  const fighter = findFighter(state, fighterId);
  if (fighter?.unlocked) state.selectedFighterId = fighterId;
}

export function addLog(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 8);
}

export { boss, LEVELS_PER_COUNTRY, MAX_FIGHTER_LEVEL, MEGA_BOX_LEVEL, MEGA_BOX_UNLOCK_CHANCE, PITY_TOKENS_FOR_UNLOCK };
