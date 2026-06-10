import { createInitialState, LEVELS_PER_COUNTRY, MAX_FIGHTER_LEVEL } from './gameLogic.js';

export const SAVE_KEY = 'zombie-liberation-save-v1';
export const SAVE_VERSION = 1;

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

export function serializeGame(state) {
  return JSON.stringify({
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  });
}

export function hydrateState(rawState) {
  const initial = createInitialState();
  if (!rawState || typeof rawState !== 'object') return initial;

  const rawCountries = Array.isArray(rawState.countries) ? rawState.countries : [];
  const rawFighters = Array.isArray(rawState.fighters) ? rawState.fighters : [];
  const byCountry = new Map(rawCountries.map((country) => [country.id, country]));
  const byFighter = new Map(rawFighters.map((fighter) => [fighter.id, fighter]));

  const countries = initial.countries.map((country) => {
    const saved = byCountry.get(country.id) || {};
    return {
      ...country,
      currentLevel: clampInteger(saved.currentLevel, 1, LEVELS_PER_COUNTRY, country.currentLevel),
      freed: saved.freed === true,
      megaBoxClaimed: saved.megaBoxClaimed === true,
    };
  });

  const fighters = initial.fighters.map((fighter) => {
    const saved = byFighter.get(fighter.id) || {};
    return {
      ...fighter,
      level: clampInteger(saved.level, 1, MAX_FIGHTER_LEVEL, fighter.level),
      unlocked: saved.unlocked === true || fighter.unlocked,
    };
  });

  const selectedCountryId = countries.some((country) => country.id === rawState.selectedCountryId)
    ? rawState.selectedCountryId
    : initial.selectedCountryId;
  const selectedFighterId = fighters.some((fighter) => fighter.id === rawState.selectedFighterId && fighter.unlocked)
    ? rawState.selectedFighterId
    : initial.selectedFighterId;

  return {
    ...initial,
    coins: clampNumber(rawState.coins, 0, Number.MAX_SAFE_INTEGER, initial.coins),
    pityTokens: clampNumber(rawState.pityTokens, 0, Number.MAX_SAFE_INTEGER, initial.pityTokens),
    pendingRewardChoice: normalizePendingRewardChoice(rawState.pendingRewardChoice, countries),
    upgradeDiscountPercent: normalizeUpgradeDiscountPercent(rawState.upgradeDiscountPercent),
    nextBattleBuff: normalizeNextBattleBuff(rawState.nextBattleBuff),
    selectedCountryId,
    selectedFighterId,
    bossDefeated: rawState.bossDefeated === true,
    countries,
    fighters,
    log: Array.isArray(rawState.log) ? rawState.log.slice(0, 8).map(String) : initial.log,
  };
}

function clampInteger(value, min, max, fallback) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function clampNumber(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizeRewardOption(option) {
  if (!option || typeof option !== 'object') return null;
  const allowedIds = new Set(['bonus_coins', 'upgrade_discount', 'pity_token', 'next_damage', 'next_hp']);
  if (!allowedIds.has(option.id)) return null;
  return {
    id: option.id,
    label: String(option.label || ''),
    description: String(option.description || ''),
  };
}

function normalizePendingRewardChoice(value, countries) {
  if (!value || typeof value !== 'object') return null;
  if (!countries.some((country) => country.id === value.countryId)) return null;
  const completedLevel = clampInteger(value.completedLevel, 1, LEVELS_PER_COUNTRY, null);
  if (completedLevel === null) return null;
  const options = Array.isArray(value.options)
    ? value.options.map(normalizeRewardOption).filter(Boolean)
    : [];
  if (options.length !== 2) return null;
  return {
    countryId: value.countryId,
    completedLevel,
    options,
  };
}

function normalizeUpgradeDiscountPercent(value) {
  return value === 25 ? 25 : 0;
}

function normalizeNextBattleBuff(value) {
  if (!value || typeof value !== 'object') return null;
  if ((value.type !== 'damage' && value.type !== 'hp') || value.percent !== 10) return null;
  return { type: value.type, percent: 10 };
}

export function saveGame(storage, state) {
  storage.setItem(SAVE_KEY, serializeGame(state));
}

export function loadGame(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createInitialState();
    return hydrateState(parsed.state);
  } catch {
    return createInitialState();
  }
}

export function resetGame(storage) {
  storage.removeItem(SAVE_KEY);
  return createInitialState();
}
