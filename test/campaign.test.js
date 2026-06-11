import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/gameLogic.js';
import { getCampaignSummary, getNextRecommendation, getCountryProgress } from '../src/campaign.js';

test('getCampaignSummary counts saved countries, total levels, and unlocked fighters', () => {
  const state = createInitialState();
  state.countries[0].freed = true;
  state.countries[1].currentLevel = 10;
  state.fighters[1].unlocked = true;

  const summary = getCampaignSummary(state);

  assert.deepEqual(summary, {
    savedCountries: 1,
    totalCountries: 5,
    totalCompletedLevels: 34,
    totalLevels: 125,
    unlockedFighters: 2,
    totalFighters: 5,
    bossUnlocked: false,
  });
});

test('getNextRecommendation points player to upgrades when selected fighter is too weak', () => {
  const state = createInitialState();
  state.countries[0].currentLevel = 18;
  state.coins = 300;

  const recommendation = getNextRecommendation(state);

  assert.equal(recommendation.kind, 'upgrade');
  assert.match(recommendation.message, /прокач/iu);
});

test('getCountryProgress returns percent and next reward label', () => {
  const state = createInitialState();
  state.countries[0].currentLevel = 10;

  const progress = getCountryProgress(state.countries[0]);

  assert.equal(progress.percent, 36);
  assert.equal(progress.nextRewardLabel, '🎁 Мегабокс зараз');
});

test('getNextRecommendation asks player to choose pending reward first', () => {
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'ukraine',
    completedLevel: 3,
    options: [
      { id: 'bonus_coins', label: 'Більше монет', description: '+35 монет' },
      { id: 'upgrade_discount', label: 'Знижка прокачки', description: 'Наступна прокачка дешевша' },
    ],
  };

  const recommendation = getNextRecommendation(state);

  assert.equal(recommendation.kind, 'reward');
  assert.match(recommendation.message, /нагор/iu);
});

test('getNextRecommendation mentions active upgrade discount', () => {
  const state = createInitialState();
  state.upgradeDiscountPercent = 25;
  state.coins = 100;

  const recommendation = getNextRecommendation(state);

  assert.equal(recommendation.kind, 'upgrade');
  assert.match(recommendation.message, /зниж/iu);
});

test('getNextRecommendation mentions next battle buff', () => {
  const state = createInitialState();
  state.nextBattleBuff = { type: 'damage', percent: 10 };

  const recommendation = getNextRecommendation(state);

  assert.equal(recommendation.kind, 'fight');
  assert.match(recommendation.message, /10% урон/iu);
});

test('getNextRecommendation does not suggest unsafe buffed fights', () => {
  const state = createInitialState();
  state.countries[0].currentLevel = 25;
  state.nextBattleBuff = { type: 'damage', percent: 10 };

  const recommendation = getNextRecommendation(state);

  assert.equal(recommendation.kind, 'upgrade');
  assert.match(recommendation.message, /небезпечно|прокач/iu);
});

test('getNextRecommendation can suggest a stronger unlocked fighter', () => {
  const state = createInitialState();
  state.fighters[2].unlocked = true;
  state.selectedFighterId = 'artem';
  state.countries[0].currentLevel = 8;

  const recommendation = getNextRecommendation(state);

  assert.match(recommendation.message, /Макс Ракета/iu);
});

test('getNextRecommendation does not suggest stronger fighter who still loses', () => {
  const state = createInitialState();
  state.fighters[2].unlocked = true;
  state.selectedFighterId = 'artem';
  state.countries[0].currentLevel = 25;

  const recommendation = getNextRecommendation(state);

  assert.equal(recommendation.kind, 'upgrade');
  assert.match(recommendation.message, /прокач/iu);
});

test('getNextRecommendation does not advertise max-level discount as Infinity', () => {
  const state = createInitialState();
  state.upgradeDiscountPercent = 25;
  state.fighters[0].level = 10;
  state.fighters[1].unlocked = true;

  const recommendation = getNextRecommendation(state);

  assert.equal(recommendation.kind, 'upgrade');
  assert.doesNotMatch(recommendation.message, /Infinity/iu);
  assert.match(recommendation.message, /Софія Щит/iu);
});
