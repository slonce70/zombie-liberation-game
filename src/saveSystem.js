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
