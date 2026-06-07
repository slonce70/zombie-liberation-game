import {
  boss,
  countries as countryData,
  fighters as fighterData,
  LEVELS_PER_COUNTRY,
  MAX_FIGHTER_LEVEL,
  MEGA_BOX_LEVEL,
  MEGA_BOX_UNLOCK_CHANCE,
  PITY_TOKENS_FOR_UNLOCK,
} from './gameData.js';

export function createInitialState() {
  return {
    coins: 0,
    pityTokens: 0,
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

export function getEnemyForLevel(level) {
  return {
    name: level >= LEVELS_PER_COUNTRY ? 'Капітан веселих зомбі' : `Зомбі рівня ${level}`,
    hp: 72 + (level - 1) * 14,
    damage: 10 + Math.floor(level * 1.8),
    emoji: level >= LEVELS_PER_COUNTRY ? '🧟‍♀️' : '🧟',
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

export function upgradeFighter(state, fighterId) {
  const fighter = findFighter(state, fighterId);
  if (!fighter || !fighter.unlocked) return { upgraded: false, reason: 'fighter_locked' };
  if (fighter.level >= MAX_FIGHTER_LEVEL) return { upgraded: false, reason: 'max_level' };

  const cost = getUpgradeCost(fighter.level);
  if (state.coins < cost) return { upgraded: false, reason: 'not_enough_coins', cost };

  state.coins -= cost;
  fighter.level += 1;
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

  if (completedLevel >= LEVELS_PER_COUNTRY) {
    country.currentLevel = LEVELS_PER_COUNTRY;
    country.freed = true;
  } else {
    country.currentLevel += 1;
  }

  return { completed: true, completedLevel, reward, boxResult, country };
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
