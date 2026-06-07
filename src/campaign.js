import {
  getBattleStats,
  getEnemyForLevel,
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

export function getNextRecommendation(state) {
  if (isBossUnlocked(state)) {
    return { kind: 'boss', message: 'Фінальний бос відкритий — спробуй командну битву!' };
  }

  const country = state.countries.find((item) => item.id === state.selectedCountryId) || state.countries[0];
  const fighter = state.fighters.find((item) => item.id === state.selectedFighterId) || state.fighters[0];
  const stats = getBattleStats(fighter);
  const enemy = getEnemyForLevel(country.currentLevel);
  const heroTurns = Math.ceil(enemy.hp / stats.damage);
  const enemyTurns = Math.ceil(stats.hp / enemy.damage);

  if (heroTurns > enemyTurns) {
    return { kind: 'upgrade', message: 'Схоже, потрібна прокачка або сильніший боєць.' };
  }

  return { kind: 'fight', message: `Продовжуй рівень ${country.currentLevel} у країні ${country.name}.` };
}
