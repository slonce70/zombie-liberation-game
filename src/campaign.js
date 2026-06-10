import {
  getBattleStats,
  getEnemyForLevel,
  getEffectiveUpgradeCost,
  isBossUnlocked,
  LEVELS_PER_COUNTRY,
  MEGA_BOX_LEVEL,
} from './gameLogic.js';

export function getCampaignSummary(state) {
  const savedCountries = state.countries.filter((country) => country.freed).length;
  const totalCompletedLevels = state.countries.reduce((sum, country) => {
    if (country.freed) return sum + LEVELS_PER_COUNTRY;
    return sum + Math.max(0, country.currentLevel - 1);
  }, 0);

  return {
    savedCountries,
    totalCountries: state.countries.length,
    totalCompletedLevels,
    totalLevels: state.countries.length * LEVELS_PER_COUNTRY,
    unlockedFighters: state.fighters.filter((fighter) => fighter.unlocked).length,
    totalFighters: state.fighters.length,
    bossUnlocked: isBossUnlocked(state),
  };
}

export function getCountryProgress(country) {
  const completed = country.freed ? LEVELS_PER_COUNTRY : Math.max(0, country.currentLevel - 1);
  const percent = Math.round((completed / LEVELS_PER_COUNTRY) * 100);
  const nextRewardLabel = country.freed
    ? '✅ Країну врятовано'
    : country.currentLevel === MEGA_BOX_LEVEL
      ? '🎁 Мегабокс зараз'
      : country.currentLevel < MEGA_BOX_LEVEL
        ? `🎁 Мегабокс через ${MEGA_BOX_LEVEL - country.currentLevel} рів.`
        : `🏁 До звільнення ${LEVELS_PER_COUNTRY - country.currentLevel + 1} рів.`;

  return { completed, total: LEVELS_PER_COUNTRY, percent, nextRewardLabel };
}

function forecastTurns(fighter, enemy) {
  const stats = getBattleStats(fighter);
  return {
    stats,
    heroTurns: Math.ceil(enemy.hp / stats.damage),
    enemyTurns: Math.ceil(stats.hp / enemy.damage),
  };
}

function bestUnlockedFighter(state, enemy) {
  return state.fighters
    .filter((fighter) => fighter.unlocked)
    .map((fighter) => ({ fighter, forecast: forecastTurns(fighter, enemy) }))
    .sort((left, right) => {
      const leftSurplus = left.forecast.enemyTurns - left.forecast.heroTurns;
      const rightSurplus = right.forecast.enemyTurns - right.forecast.heroTurns;
      if (rightSurplus !== leftSurplus) return rightSurplus - leftSurplus;
      return right.forecast.stats.damage - left.forecast.stats.damage;
    })[0] || null;
}

export function getNextRecommendation(state) {
  if (state.pendingRewardChoice) {
    return { kind: 'reward', message: 'Спочатку обери тактичну нагороду за пройдений рівень.' };
  }

  if (isBossUnlocked(state)) {
    return { kind: 'boss', message: 'Фінальний бос відкритий — спробуй командну битву!' };
  }

  const country = state.countries.find((item) => item.id === state.selectedCountryId) || state.countries[0];
  const fighter = state.fighters.find((item) => item.id === state.selectedFighterId && item.unlocked)
    || state.fighters.find((item) => item.unlocked)
    || state.fighters[0];
  const enemy = getEnemyForLevel(country.currentLevel);
  const current = forecastTurns(fighter, enemy);
  const best = bestUnlockedFighter(state, enemy);

  if (state.upgradeDiscountPercent === 25) {
    const cost = getEffectiveUpgradeCost(state, fighter.level);
    return { kind: 'upgrade', message: `Є знижка 25%: ${fighter.name} можна прокачати за ${cost} монет.` };
  }

  if (state.nextBattleBuff?.type === 'damage') {
    return { kind: 'fight', message: 'Наступний бій має +10% урону — гарний момент атакувати.' };
  }
  if (state.nextBattleBuff?.type === 'hp') {
    return { kind: 'fight', message: 'Наступний бій має +10% HP — можна безпечніше ризикнути.' };
  }

  if (best && best.fighter.id !== fighter.id) {
    const bestSurplus = best.forecast.enemyTurns - best.forecast.heroTurns;
    const currentSurplus = current.enemyTurns - current.heroTurns;
    if (bestSurplus > currentSurplus || (
      bestSurplus === currentSurplus
      && best.forecast.stats.damage > current.stats.damage
    )) {
      return { kind: 'fighter', message: `${best.fighter.name} краще підходить проти ${enemy.archetypeName}.` };
    }
  }

  if (current.heroTurns > current.enemyTurns) {
    return { kind: 'upgrade', message: `Небезпечно: потрібна прокачка або сильніший боєць проти ${enemy.archetypeName}.` };
  }

  if (country.currentLevel < MEGA_BOX_LEVEL) {
    return {
      kind: 'fight',
      message: `Продовжуй ${country.name}: до Мегабокса ${MEGA_BOX_LEVEL - country.currentLevel} рів.`,
    };
  }

  return {
    kind: 'fight',
    message: `Проти тебе ${enemy.archetypeName}. Перемога ймовірна за ${current.heroTurns} удари.`,
  };
}
