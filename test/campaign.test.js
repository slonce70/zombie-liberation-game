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
