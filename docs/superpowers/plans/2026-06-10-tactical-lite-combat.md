# Tactical Lite Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tactical Lite combat: hero passives, deterministic enemy archetypes, reward choices, smarter recommendations, and mobile-safe UI without breaking existing step combat or old saves.

**Architecture:** Keep the current split: persistent campaign rules in `src/gameLogic.js`, campaign summaries/recommendations in `src/campaign.js`, save normalization in `src/saveSystem.js`, and DOM rendering/event sequencing in `src/main.js`. Add small data contracts in `src/gameData.js`, keep active battle sessions non-persisted, and extend tests before each behavior change.

**Tech Stack:** Static ES modules, browser DOM rendering, CSS animations, localStorage save/load, Node built-in test runner, existing smoke script, existing sprite validation scripts.

---

## File Structure

- Modify `src/gameData.js`: add passive metadata, enemy archetype metadata, special reward level list, and reward definitions.
- Modify `src/gameLogic.js`: add state defaults, enemy archetype helpers, reward helpers, effective upgrade cost, passive combat modifiers, battle replay validation, and buff consumption.
- Modify `src/saveSystem.js`: normalize new optional save fields in `hydrateState(rawState)` while keeping `SAVE_VERSION = 1`.
- Modify `src/campaign.js`: upgrade `getNextRecommendation(state)` so it understands pending rewards, discounts, buffs, enemy risk, and better fighter suggestions.
- Modify `src/main.js`: render passive/enemy/reward UI, block fights while a reward is pending, wire reward buttons, show passive notices, and keep combat animation state stable.
- Modify `src/styles.css`: style enemy badges, passive text, reward choice panel, tactical notices, and mobile layout.
- Modify `scripts/smoke-check.mjs`: assert the tactical UI hooks and new labels exist.
- Modify tests:
  - `test/saveSystem.test.js`
  - `test/gameLogic.test.js`
  - `test/campaign.test.js`
  - `test/adversarialGame.test.js`
  - `test/smoke-check` coverage through `npm run smoke`
- No new dependencies.

## Task 1: Add Tactical State Defaults And Save Normalization

**Files:**
- Modify: `src/gameLogic.js`
- Modify: `src/saveSystem.js`
- Test: `test/saveSystem.test.js`

- [ ] **Step 1: Write failing save tests**

Append these tests to `test/saveSystem.test.js`:

```js
test('new tactical fields default on a fresh game', () => {
  const storage = createMemoryStorage();

  const loaded = loadGame(storage);

  assert.equal(loaded.pendingRewardChoice, null);
  assert.equal(loaded.upgradeDiscountPercent, 0);
  assert.equal(loaded.nextBattleBuff, null);
});

test('old saves without tactical fields hydrate with backward-compatible defaults', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  delete state.pendingRewardChoice;
  delete state.upgradeDiscountPercent;
  delete state.nextBattleBuff;
  storage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    savedAt: '2026-06-10T00:00:00.000Z',
    state,
  }));

  const loaded = loadGame(storage);

  assert.equal(loaded.pendingRewardChoice, null);
  assert.equal(loaded.upgradeDiscountPercent, 0);
  assert.equal(loaded.nextBattleBuff, null);
  assert.equal(loaded.selectedCountryId, 'ukraine');
  assert.equal(loaded.selectedFighterId, 'artem');
});

test('invalid tactical save fields are clamped or ignored', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'missing-country',
    completedLevel: 999,
    options: [{ id: 'bad-option', label: '<script>', description: 'bad' }],
  };
  state.upgradeDiscountPercent = 999;
  state.nextBattleBuff = { type: 'speed', percent: 500 };
  storage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    savedAt: '2026-06-10T00:00:00.000Z',
    state,
  }));

  const loaded = loadGame(storage);

  assert.equal(loaded.pendingRewardChoice, null);
  assert.equal(loaded.upgradeDiscountPercent, 0);
  assert.equal(loaded.nextBattleBuff, null);
});

test('valid tactical save fields are preserved', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'ukraine',
    completedLevel: 3,
    options: [
      { id: 'bonus_coins', label: 'Більше монет', description: '+35 монет' },
      { id: 'upgrade_discount', label: 'Знижка прокачки', description: 'Наступна прокачка дешевша' },
    ],
  };
  state.upgradeDiscountPercent = 25;
  state.nextBattleBuff = { type: 'damage', percent: 10 };

  saveGame(storage, state);
  const loaded = loadGame(storage);

  assert.deepEqual(loaded.pendingRewardChoice, state.pendingRewardChoice);
  assert.equal(loaded.upgradeDiscountPercent, 25);
  assert.deepEqual(loaded.nextBattleBuff, { type: 'damage', percent: 10 });
});
```

- [ ] **Step 2: Run save tests and verify failure**

Run:

```bash
node --test test/saveSystem.test.js
```

Expected: FAIL because tactical fields are not created or normalized yet.

- [ ] **Step 3: Add tactical defaults to initial state**

In `src/gameLogic.js`, update `createInitialState()` so the returned object includes these fields after `pityTokens`:

```js
    pendingRewardChoice: null,
    upgradeDiscountPercent: 0,
    nextBattleBuff: null,
```

- [ ] **Step 4: Add normalization helpers to `src/saveSystem.js`**

Add these helpers after `clampNumber()`:

```js
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
```

- [ ] **Step 5: Preserve normalized tactical fields in `hydrateState()`**

In the final returned object from `hydrateState(rawState)`, add these properties after `pityTokens`:

```js
    pendingRewardChoice: normalizePendingRewardChoice(rawState.pendingRewardChoice, countries),
    upgradeDiscountPercent: normalizeUpgradeDiscountPercent(rawState.upgradeDiscountPercent),
    nextBattleBuff: normalizeNextBattleBuff(rawState.nextBattleBuff),
```

- [ ] **Step 6: Run save tests**

Run:

```bash
node --test test/saveSystem.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/gameLogic.js src/saveSystem.js test/saveSystem.test.js
git commit -m "feat: normalize tactical save state"
```

Expected: commit succeeds with only Task 1 files.

## Task 2: Add Enemy Archetypes And Passive Metadata

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameLogic.js`
- Test: `test/gameLogic.test.js`

- [ ] **Step 1: Write failing enemy and passive metadata tests**

Extend the import block in `test/gameLogic.test.js` with:

```js
  getEnemyArchetype,
  getFighterPassive,
```

Append these tests:

```js
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
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
node --test test/gameLogic.test.js
```

Expected: FAIL because `getEnemyArchetype` and `getFighterPassive` are not exported yet.

- [ ] **Step 3: Add passive and enemy data contracts**

In `src/gameData.js`, add these exports after `fighters` and before `boss`:

```js
export const fighterPassives = {
  artem: {
    id: 'spark_tempo',
    name: 'Іскровий темп',
    description: 'Кожен 3-й удар сильніший.',
  },
  sofia: {
    id: 'team_shield',
    name: 'Щит команди',
    description: 'Перший удар ворога слабший.',
  },
  maks: {
    id: 'rocket_start',
    name: 'Ракетний старт',
    description: 'Перший удар сильніший.',
  },
  lina: {
    id: 'weak_spot',
    name: 'Слабке місце',
    description: 'Позначає слабке місце ворога.',
  },
  danylo: {
    id: 'finisher',
    name: 'Фінішер',
    description: 'Сильніше добиває поранених ворогів.',
  },
};

export const enemyArchetypes = {
  normal: {
    id: 'normal',
    name: 'Звичайний зомбі',
    traitText: 'Без особливих трюків',
    hpMultiplier: 1,
    damageMultiplier: 1,
  },
  fast: {
    id: 'fast',
    name: 'Швидкий зомбі',
    traitText: 'Менше HP, але сильніший контрудар',
    hpMultiplier: 0.8,
    damageMultiplier: 1.25,
  },
  tank: {
    id: 'tank',
    name: 'Зомбі-Танк',
    traitText: 'Більше HP, менше урону',
    hpMultiplier: 1.35,
    damageMultiplier: 0.9,
  },
  armored: {
    id: 'armored',
    name: 'Броньований зомбі',
    traitText: 'Перший удар по ньому слабший',
    hpMultiplier: 1.1,
    damageMultiplier: 1,
    firstHitDamageMultiplier: 0.65,
  },
  captain: {
    id: 'captain',
    name: 'Капітан веселих зомбі',
    traitText: 'Мінібос із підсиленим HP та уроном',
    hpMultiplier: 1.45,
    damageMultiplier: 1.15,
  },
};
```

- [ ] **Step 4: Import new data in `src/gameLogic.js`**

Update the import from `./gameData.js` to include:

```js
  enemyArchetypes,
  fighterPassives,
```

- [ ] **Step 5: Add archetype and passive helpers**

In `src/gameLogic.js`, add this code before `getEnemyForLevel(level)`:

```js
function scaleStat(value, multiplier) {
  return Math.max(1, Math.round(value * multiplier));
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
```

- [ ] **Step 6: Update `getEnemyForLevel(level)`**

Replace the current function with:

```js
export function getEnemyForLevel(level) {
  const archetype = getEnemyArchetype(level);
  const baseHp = 72 + (level - 1) * 14;
  const baseDamage = 10 + Math.floor(level * 1.8);
  const isCountryFinal = level >= LEVELS_PER_COUNTRY;
  return {
    name: isCountryFinal ? 'Капітан веселих зомбі' : `${archetype.name} рівня ${level}`,
    hp: scaleStat(baseHp, archetype.hpMultiplier),
    damage: scaleStat(baseDamage, archetype.damageMultiplier),
    emoji: isCountryFinal ? '🧟‍♀️' : '🧟',
    archetypeId: archetype.id,
    archetypeName: archetype.name,
    traitText: archetype.traitText,
    firstHitDamageMultiplier: archetype.firstHitDamageMultiplier || 1,
  };
}
```

- [ ] **Step 7: Run game logic tests**

Run:

```bash
node --test test/gameLogic.test.js
```

Expected: PASS or only failures from older tests that asserted old level stats. If older assertions fail, update those assertions to the new level-1 normal stats only; level 1 must remain `hp: 72` and `damage: 11`.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add src/gameData.js src/gameLogic.js test/gameLogic.test.js
git commit -m "feat: add tactical enemy and passive metadata"
```

Expected: commit succeeds with only Task 2 files.

## Task 3: Add Reward Choices And Discounted Upgrade Costs

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameLogic.js`
- Test: `test/gameLogic.test.js`
- Test: `test/adversarialGame.test.js`

- [ ] **Step 1: Write failing reward tests**

Extend the import block in `test/gameLogic.test.js` with:

```js
  createRewardChoice,
  applyRewardChoice,
  getEffectiveUpgradeCost,
```

Append these tests:

```js
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
```

- [ ] **Step 2: Extend adversarial reward test imports**

In `test/adversarialGame.test.js`, add this name to the existing import from `../src/gameLogic.js`:

```js
  applyRewardChoice,
```

- [ ] **Step 3: Add adversarial reward test**

Append this test to `test/adversarialGame.test.js`:

```js
test('reward choice cannot be applied with a forged option id', () => {
  const state = createInitialState();
  state.pendingRewardChoice = {
    countryId: 'ukraine',
    completedLevel: 3,
    options: [
      { id: 'bonus_coins', label: 'Більше монет', description: '+35 монет' },
      { id: 'upgrade_discount', label: 'Знижка прокачки', description: 'Наступна прокачка дешевша' },
    ],
  };

  const result = applyRewardChoice(state, 'unlock_all_fighters');

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'reward_unavailable');
  assert.equal(state.coins, 0);
  assert.equal(state.pendingRewardChoice.options.length, 2);
});
```

- [ ] **Step 4: Run tests and verify failure**

Run:

```bash
node --test test/gameLogic.test.js test/adversarialGame.test.js
```

Expected: FAIL because reward helpers do not exist yet.

- [ ] **Step 5: Add reward data contracts**

In `src/gameData.js`, add these exports after `enemyArchetypes`:

```js
export const SPECIAL_REWARD_LEVELS = [3, 7, 13, 18, 23];

export const rewardDefinitions = {
  bonus_coins: {
    id: 'bonus_coins',
    label: 'Більше монет',
    description: '+35 монет одразу',
  },
  upgrade_discount: {
    id: 'upgrade_discount',
    label: 'Знижка прокачки',
    description: 'Наступна прокачка дешевша на 25%',
  },
  pity_token: {
    id: 'pity_token',
    label: 'Жетон удачі',
    description: '+1 жетон удачі до Мегабокса',
  },
  next_damage: {
    id: 'next_damage',
    label: 'Бойовий настрій',
    description: 'Наступний бій: +10% урону',
  },
  next_hp: {
    id: 'next_hp',
    label: 'Міцний дух',
    description: 'Наступний бій: +10% HP',
  },
};
```

- [ ] **Step 6: Import reward contracts in `src/gameLogic.js`**

Update the import from `./gameData.js` to include:

```js
  rewardDefinitions,
  SPECIAL_REWARD_LEVELS,
```

- [ ] **Step 7: Add reward helper functions**

Add this code after `openMegaBox(state, random = Math.random)`:

```js
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
  if (state.pendingRewardChoice) return { created: false, reason: 'reward_already_pending' };
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
```

- [ ] **Step 8: Use effective upgrade cost in `upgradeFighter()`**

In `upgradeFighter(state, fighterId)`, replace:

```js
  const cost = getUpgradeCost(fighter.level);
```

with:

```js
  const cost = getEffectiveUpgradeCost(state, fighter.level);
```

After `fighter.level += 1;`, add:

```js
  state.upgradeDiscountPercent = 0;
```

- [ ] **Step 9: Trigger reward choice from `completeLevel()`**

In `completeLevel(state, countryId, random = Math.random)`, after the mega box block and before the country level is incremented, add:

```js
  const rewardChoice = createRewardChoice(state, country.id, completedLevel);
```

In the returned object, include:

```js
  rewardChoice: rewardChoice.created ? rewardChoice.rewardChoice : null,
```

- [ ] **Step 10: Run reward tests**

Run:

```bash
node --test test/gameLogic.test.js test/adversarialGame.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit Task 3**

Run:

```bash
git add src/gameData.js src/gameLogic.js test/gameLogic.test.js test/adversarialGame.test.js
git commit -m "feat: add tactical reward choices"
```

Expected: commit succeeds with only Task 3 files.

## Task 4: Apply Passives, Enemy Traits, Buffs, And Replay Validation

**Files:**
- Modify: `src/gameLogic.js`
- Test: `test/gameLogic.test.js`
- Test: `test/adversarialGame.test.js`

- [ ] **Step 1: Write failing passive combat tests**

Append these tests to `test/gameLogic.test.js`:

```js
test('Artem passive boosts every third real attack', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  const first = applyHeroAttack(session);
  session = first.session;
  const second = applyHeroAttack(session);
  session = second.session;
  const third = applyHeroAttack(session);

  assert.equal(first.damage, 34);
  assert.equal(second.damage, 34);
  assert.equal(third.damage, 51);
});

test('Sofia passive reduces only the first incoming hit', () => {
  const state = createInitialState();
  state.fighters[1].unlocked = true;
  let session = createBattleSession(state, 'sofia', 'ukraine').session;
  session.enemy.currentHp = session.enemy.maxHp;

  const first = applyEnemyCounterAttack(session);
  const second = applyEnemyCounterAttack(first.session);

  assert.equal(first.damage, 6);
  assert.equal(second.damage, 11);
});

test('Maks passive boosts only the first attack', () => {
  const state = createInitialState();
  state.fighters[2].unlocked = true;
  let session = createBattleSession(state, 'maks', 'ukraine').session;

  const first = applyHeroAttack(session);
  const second = applyHeroAttack(first.session);

  assert.equal(first.damage, 59);
  assert.equal(second.damage, 44);
});

test('Lina passive marks the target and boosts later hits', () => {
  const state = createInitialState();
  state.fighters[3].unlocked = true;
  let session = createBattleSession(state, 'lina', 'ukraine').session;

  const first = applyHeroAttack(session);
  const second = applyHeroAttack(first.session);

  assert.equal(first.damage, 32);
  assert.equal(first.session.enemy.marked, true);
  assert.equal(second.damage, 37);
});

test('Danylo passive boosts attacks against low HP enemies', () => {
  const state = createInitialState();
  state.fighters[4].unlocked = true;
  let session = createBattleSession(state, 'danylo', 'ukraine').session;
  session = {
    ...session,
    enemy: { ...session.enemy, currentHp: 20 },
  };

  const result = applyHeroAttack(session);

  assert.equal(result.damage, 55);
});

test('armored enemy reduces only the first incoming hero hit', () => {
  const state = createInitialState();
  state.countries[0].currentLevel = 4;
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  const first = applyHeroAttack(session);
  const second = applyHeroAttack(first.session);

  assert.equal(first.damage, 22);
  assert.equal(second.damage, 34);
});

test('next battle damage buff is consumed only after a successful session is created', () => {
  const state = createInitialState();
  state.nextBattleBuff = { type: 'damage', percent: 10 };

  const invalid = createBattleSession(state, 'sofia', 'ukraine');
  const valid = createBattleSession(state, 'artem', 'ukraine');

  assert.equal(invalid.created, false);
  assert.deepEqual(state.nextBattleBuff, { type: 'damage', percent: 10 });
  assert.equal(valid.session.hero.damage, 37);
  assert.equal(state.nextBattleBuff, null);
});

test('next battle hp buff is consumed when a session is created', () => {
  const state = createInitialState();
  state.nextBattleBuff = { type: 'hp', percent: 10 };

  const valid = createBattleSession(state, 'artem', 'ukraine');

  assert.equal(valid.session.hero.maxHp, 149);
  assert.equal(valid.session.hero.currentHp, 149);
  assert.equal(state.nextBattleBuff, null);
});
```

- [ ] **Step 2: Write forged replay validation test**

In `test/adversarialGame.test.js`, add these names to the existing import from `../src/gameLogic.js`:

```js
  createBattleSession,
  applyHeroAttack,
  resolveBattleVictory,
```

Append this test to `test/adversarialGame.test.js`:

```js
test('forged passive victory that skips enemy counters is rejected', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;
  session = {
    ...session,
    enemy: { ...session.enemy, currentHp: 0 },
    enemyCounterCount: 0,
  };

  const result = resolveBattleVictory(state, session, () => 0.99);

  assert.equal(result.completed, false);
  assert.equal(result.reason, 'stale_battle');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
node --test test/gameLogic.test.js test/adversarialGame.test.js
```

Expected: FAIL because passives, buffs, armored traits, or replay validation are not implemented.

- [ ] **Step 4: Extend battle session shape in `createBattleSession()`**

In `src/gameLogic.js`, update `createBattleSession()` so hero stats can consume `nextBattleBuff` only after validation succeeds:

```js
  let stats = getBattleStats(fighter);
  const appliedBuff = state.nextBattleBuff;
  if (appliedBuff?.type === 'damage') {
    stats = { ...stats, damage: Math.round(stats.damage * 1.1) };
  }
  if (appliedBuff?.type === 'hp') {
    stats = { ...stats, hp: Math.round(stats.hp * 1.1) };
  }
  if (appliedBuff) state.nextBattleBuff = null;
```

In the returned `session`, include these fields:

```js
      appliedBuff,
      passiveEvents: [],
      heroDamageTotal: 0,
      enemyDamageTotal: 0,
```

Inside `hero`, add:

```js
        baseDamage: stats.damage,
```

Inside `enemy`, add:

```js
        archetypeId: enemy.archetypeId,
        archetypeName: enemy.archetypeName,
        traitText: enemy.traitText,
        firstHitDamageMultiplier: enemy.firstHitDamageMultiplier,
        armorUsed: false,
        marked: false,
```

- [ ] **Step 5: Add passive damage helpers**

Add this code before `applyHeroAttack(session)`:

```js
function roundDamage(value) {
  return Math.max(0, Math.round(value));
}

function passiveEvent(passiveId, label) {
  return { passiveId, label };
}

function calculateHeroDamage(session) {
  let damage = session.hero.damage;
  const events = [];
  const nextAttackNumber = (session.heroAttackCount ?? 0) + 1;

  if (session.fighterId === 'artem' && nextAttackNumber % 3 === 0) {
    damage *= 1.5;
    events.push(passiveEvent('spark_tempo', 'Іскровий темп'));
  }
  if (session.fighterId === 'maks' && nextAttackNumber === 1) {
    damage *= 1.35;
    events.push(passiveEvent('rocket_start', 'Ракетний старт'));
  }
  if (session.fighterId === 'lina' && session.enemy.marked) {
    damage *= 1.15;
    events.push(passiveEvent('weak_spot_bonus', 'Слабке місце'));
  }
  if (session.fighterId === 'danylo' && session.enemy.currentHp <= session.enemy.maxHp * 0.35) {
    damage *= 1.4;
    events.push(passiveEvent('finisher', 'Фінішер'));
  }
  if (session.enemy.archetypeId === 'armored' && !session.enemy.armorUsed) {
    damage *= session.enemy.firstHitDamageMultiplier;
    events.push(passiveEvent('armored_enemy', 'Броня зомбі'));
  }

  return { damage: roundDamage(damage), events };
}
```

- [ ] **Step 6: Update `applyHeroAttack(session)`**

Replace the direct damage calculation with:

```js
  const calculated = calculateHeroDamage(next);
  const damage = calculated.damage;
  next.enemy.currentHp = clampHp(next.enemy.currentHp - damage, next.enemy.maxHp);
  next.heroAttackCount = (next.heroAttackCount ?? 0) + 1;
  next.heroDamageTotal = (next.heroDamageTotal ?? 0) + damage;
  next.lastPassiveEvents = calculated.events;
  next.passiveEvents = [...(next.passiveEvents || []), ...calculated.events];
  if (next.fighterId === 'lina') next.enemy.marked = true;
  if (next.enemy.archetypeId === 'armored' && !next.enemy.armorUsed) next.enemy.armorUsed = true;
  return { session: next, damage, target: 'enemy', passiveEvents: calculated.events };
```

- [ ] **Step 7: Update `applyEnemyCounterAttack(session)` for Sofia**

Replace the direct enemy damage calculation with:

```js
  let damage = next.enemy.damage;
  const events = [];
  if (next.fighterId === 'sofia' && (next.enemyCounterCount ?? 0) === 0) {
    damage *= 0.5;
    events.push(passiveEvent('team_shield', 'Щит команди'));
  }
  damage = roundDamage(damage);
  next.hero.currentHp = clampHp(next.hero.currentHp - damage, next.hero.maxHp);
  next.enemyCounterCount = (next.enemyCounterCount ?? 0) + 1;
  next.enemyDamageTotal = (next.enemyDamageTotal ?? 0) + damage;
  next.lastPassiveEvents = events;
  next.passiveEvents = [...(next.passiveEvents || []), ...events];
  return { session: next, damage, target: 'hero', passiveEvents: events };
```

- [ ] **Step 8: Replace simple victory validation with replay validation**

Add this helper before `resolveBattleVictory()`:

```js
function replayBattleToCounts(session) {
  let replay = {
    ...session,
    heroAttackCount: 0,
    enemyCounterCount: 0,
    heroDamageTotal: 0,
    enemyDamageTotal: 0,
    passiveEvents: [],
    lastPassiveEvents: [],
    hero: { ...session.hero, currentHp: session.hero.maxHp },
    enemy: {
      ...session.enemy,
      currentHp: session.enemy.maxHp,
      armorUsed: false,
      marked: false,
    },
  };

  for (let i = 0; i < session.heroAttackCount; i += 1) {
    replay = applyHeroAttack(replay).session;
    if (getBattleOutcome(replay) !== 'ongoing') break;
    replay = applyEnemyCounterAttack(replay).session;
    if (getBattleOutcome(replay) !== 'ongoing') break;
  }

  return replay;
}

function battleSessionMatchesReplay(session, replay) {
  return session.hero.currentHp === replay.hero.currentHp
    && session.enemy.currentHp === replay.enemy.currentHp
    && session.heroAttackCount === replay.heroAttackCount
    && session.enemyCounterCount === replay.enemyCounterCount
    && session.heroDamageTotal === replay.heroDamageTotal
    && session.enemyDamageTotal === replay.enemyDamageTotal
    && session.enemy.armorUsed === replay.enemy.armorUsed
    && session.enemy.marked === replay.enemy.marked;
}
```

In `resolveBattleVictory()`, replace the old `expectedHeroAttackCount`, `expectedEnemyCounterCount`, `expectedEnemyHp`, and `expectedHeroHp` validation block with:

```js
  const replay = replayBattleToCounts(session);
  if (
    session.hero.maxHp !== stats.hp
    || session.hero.damage !== stats.damage
    || session.enemy.name !== enemy.name
    || session.enemy.emoji !== enemy.emoji
    || session.enemy.maxHp !== enemy.hp
    || session.enemy.damage !== enemy.damage
    || session.enemy.archetypeId !== enemy.archetypeId
    || session.enemy.firstHitDamageMultiplier !== enemy.firstHitDamageMultiplier
    || !Number.isInteger(session.heroAttackCount)
    || !Number.isInteger(session.enemyCounterCount)
    || !battleSessionMatchesReplay(session, replay)
  ) {
    return { completed: false, reason: 'stale_battle' };
  }
```

- [ ] **Step 9: Preserve validation for applied buffs**

Still in `resolveBattleVictory()`, compute expected stats from `session.appliedBuff` before comparing:

```js
  let stats = getBattleStats(fighter);
  if (session.appliedBuff?.type === 'damage') stats = { ...stats, damage: Math.round(stats.damage * 1.1) };
  if (session.appliedBuff?.type === 'hp') stats = { ...stats, hp: Math.round(stats.hp * 1.1) };
```

Use this adjusted `stats` in the validation block.

- [ ] **Step 10: Run passive and adversarial tests**

Run:

```bash
node --test test/gameLogic.test.js test/adversarialGame.test.js
```

Expected: PASS.

- [ ] **Step 11: Commit Task 4**

Run:

```bash
git add src/gameLogic.js test/gameLogic.test.js test/adversarialGame.test.js
git commit -m "feat: apply tactical combat passives"
```

Expected: commit succeeds with only Task 4 files.

## Task 5: Upgrade Campaign Recommendations

**Files:**
- Modify: `src/campaign.js`
- Test: `test/campaign.test.js`

- [ ] **Step 1: Write failing recommendation tests**

Append these tests to `test/campaign.test.js`:

```js
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

test('getNextRecommendation can suggest a stronger unlocked fighter', () => {
  const state = createInitialState();
  state.fighters[2].unlocked = true;
  state.selectedFighterId = 'artem';
  state.countries[0].currentLevel = 8;

  const recommendation = getNextRecommendation(state);

  assert.match(recommendation.message, /Макс Ракета/iu);
});
```

- [ ] **Step 2: Run campaign tests and verify failure**

Run:

```bash
node --test test/campaign.test.js
```

Expected: FAIL because recommendation kinds/messages do not include tactical state.

- [ ] **Step 3: Import needed helpers**

In `src/campaign.js`, update the import from `./gameLogic.js` to include:

```js
  getEffectiveUpgradeCost,
```

- [ ] **Step 4: Add local battle forecast helpers**

In `src/campaign.js`, add these helpers before `getNextRecommendation(state)`:

```js
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
```

- [ ] **Step 5: Replace `getNextRecommendation(state)` body**

Replace the body with:

```js
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
    if (bestSurplus > currentSurplus) {
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
```

- [ ] **Step 6: Run campaign tests**

Run:

```bash
node --test test/campaign.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add src/campaign.js test/campaign.test.js
git commit -m "feat: improve tactical recommendations"
```

Expected: commit succeeds with only Task 5 files.

## Task 6: Wire Tactical UI And Reward Actions

**Files:**
- Modify: `src/main.js`
- Test: `scripts/smoke-check.mjs`

- [ ] **Step 1: Update imports in `src/main.js`**

Add these imports from `./gameLogic.js`:

```js
  applyRewardChoice,
  getFighterPassive,
  getEffectiveUpgradeCost,
```

- [ ] **Step 2: Add render helpers**

Add these helpers after `renderActionNotice()`:

```js
function renderPassiveHint(fighter) {
  const passive = getFighterPassive(fighter.id);
  if (!passive) return '';
  return `
    <span class="passive-hint" title="${escapeHtml(passive.name)}">
      <strong>${escapeHtml(passive.name)}</strong>
      <small>${escapeHtml(passive.description)}</small>
    </span>
  `;
}

function renderEnemyTrait(enemy) {
  if (!enemy?.archetypeName) return '';
  return `
    <span class="enemy-trait">
      <strong>${escapeHtml(enemy.archetypeName)}</strong>
      <small>${escapeHtml(enemy.traitText)}</small>
    </span>
  `;
}

function renderPassiveEvents() {
  const events = activeBattle?.lastPassiveEvents || [];
  if (events.length === 0) return '';
  return `
    <span class="passive-events" aria-live="polite">
      ${events.map((event) => escapeHtml(event.label)).join(' + ')}
    </span>
  `;
}

function renderRewardChoice() {
  const pending = state.pendingRewardChoice;
  if (!pending) return '';
  return `
    <section class="reward-choice" role="status" aria-live="polite">
      <strong>Обери тактичну нагороду</strong>
      <div class="reward-options">
        ${pending.options.map((option) => `
          <button data-reward="${escapeHtml(option.id)}" aria-label="${escapeHtml(option.label)}">
            <span>${escapeHtml(option.label)}</span>
            <small>${escapeHtml(option.description)}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}
```

- [ ] **Step 3: Render reward choice and tactical labels**

In `render()`, after `${renderActionNotice()}`, add:

```js
    ${renderRewardChoice()}
```

In the hero sprite block, after `${renderHpPanel(fighter.name, heroCombatant)}`, add:

```js
            ${renderPassiveHint(fighter)}
            ${renderPassiveEvents()}
```

In the enemy sprite block, after the enemy HP panel expression, add:

```js
            ${enemy ? renderEnemyTrait(enemy) : ''}
```

- [ ] **Step 4: Block fights while reward is pending**

Change:

```js
  const fightDisabled = country.freed || isBattleAnimating;
```

to:

```js
  const fightDisabled = country.freed || isBattleAnimating || Boolean(state.pendingRewardChoice);
```

At the start of `handleFight()`, after `clearActionNotice();`, add:

```js
  if (state.pendingRewardChoice) {
    setActionNotice('warning', 'Спочатку обери тактичну нагороду.');
    render();
    return;
  }
```

- [ ] **Step 5: Show passive events during attacks**

In `handleFight()`, after `const heroAttack = applyHeroAttack(activeBattle);`, keep:

```js
  activeBattle = heroAttack.session;
```

No extra state is needed because `activeBattle.lastPassiveEvents` now contains the last events.

After `const enemyAttack = applyEnemyCounterAttack(activeBattle);`, keep:

```js
  activeBattle = enemyAttack.session;
```

- [ ] **Step 6: Use discounted cost in fighter cards**

In `renderFighterCard(fighter)`, replace:

```js
  const cost = getUpgradeCost(fighter.level);
```

with:

```js
  const cost = getEffectiveUpgradeCost(state, fighter.level);
```

Change the upgrade button label to include the discount:

```js
        ⬆️ Прокачати ${fighter.level < MAX_FIGHTER_LEVEL ? `за ${cost} монет${state.upgradeDiscountPercent === 25 ? ' зі знижкою' : ''}` : 'MAX'}
```

- [ ] **Step 7: Add reward click handler**

Add this function before `handleReset()`:

```js
function handleRewardChoice(rewardId) {
  const result = applyRewardChoice(state, rewardId);
  if (!result.applied) {
    const message = 'Цю нагороду вже не можна забрати.';
    setActionNotice('warning', message);
    addLog(state, message);
    return;
  }

  clearActiveBattle();
  setActionNotice('success', result.message);
  addLog(state, result.message);
}
```

In the click listener, before the boss action block, add:

```js
  if (target.dataset.reward) handleRewardChoice(target.dataset.reward);
```

- [ ] **Step 8: Add reward logging after victory**

In `handleFight()`, inside the `if (result.completed)` block after the Mегабокс log, add:

```js
      if (result.progress.rewardChoice) addLog(state, '🎯 Доступна тактична нагорода — обери один варіант.');
```

- [ ] **Step 9: Update smoke script**

In `scripts/smoke-check.mjs`, add checks for these strings in the rendered/source scan area used by the current script:

```js
'reward-choice',
'passive-hint',
'enemy-trait',
'data-reward',
```

Use the existing assertion style in `scripts/smoke-check.mjs`; do not add a new test framework.

- [ ] **Step 10: Run syntax and smoke checks**

Run:

```bash
node --check src/main.js
npm run smoke
```

Expected: both commands PASS.

- [ ] **Step 11: Commit Task 6**

Run:

```bash
git add src/main.js scripts/smoke-check.mjs
git commit -m "feat: wire tactical combat ui"
```

Expected: commit succeeds with only Task 6 files.

## Task 7: Add Tactical Styles And Mobile Polish

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add tactical component styles**

Add this CSS near the existing HP/damage styles:

```css
.passive-hint,
.enemy-trait,
.passive-events {
  width: min(240px, 96%);
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  border: 2px solid rgba(18, 28, 54, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #1d2742;
  font-size: 0.78rem;
  line-height: 1.15;
}

.passive-hint strong,
.enemy-trait strong,
.passive-events {
  font-weight: 900;
}

.passive-hint small,
.enemy-trait small {
  font-size: 0.72rem;
  color: #536079;
}

.passive-events {
  border-color: rgba(255, 184, 75, 0.45);
  background: #fff3c7;
  color: #7a4a00;
}

.reward-choice {
  display: grid;
  gap: 12px;
  margin: 0 0 18px;
  padding: 16px;
  border: 2px solid rgba(255, 184, 75, 0.48);
  border-radius: 8px;
  background: #fff7d8;
  box-shadow: 0 10px 24px rgba(31, 44, 80, 0.12);
}

.reward-choice > strong {
  font-size: 1rem;
  font-weight: 950;
  color: #2f3148;
}

.reward-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.reward-options button {
  min-height: 72px;
  display: grid;
  gap: 4px;
  align-content: center;
  text-align: left;
}

.reward-options button span {
  font-weight: 900;
}

.reward-options button small {
  color: #536079;
  font-weight: 700;
}
```

- [ ] **Step 2: Add mobile reward layout**

Inside the existing `@media (max-width: 700px)` block, add:

```css
  .reward-choice {
    margin-bottom: 76px;
    padding: 12px;
  }

  .reward-options {
    grid-template-columns: 1fr;
  }

  .reward-options button {
    min-height: 64px;
  }

  .passive-hint,
  .enemy-trait,
  .passive-events {
    width: min(220px, 92%);
    font-size: 0.74rem;
  }
```

- [ ] **Step 3: Add reduced motion stability**

Inside the existing `@media (prefers-reduced-motion: reduce)` block, add:

```css
  .passive-events {
    transition: none;
  }
```

- [ ] **Step 4: Run CSS-adjacent verification**

Run:

```bash
npm run smoke
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

Run:

```bash
git add src/styles.css
git commit -m "style: add tactical combat ui polish"
```

Expected: commit succeeds with only `src/styles.css`.

## Task 8: Full Verification, Browser QA, And Balance Check

**Files:**
- Modify only files needed for fixes discovered by verification.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run verify
```

Expected: PASS. If it fails, fix the failing task at the smallest relevant layer, then rerun `npm run verify`.

- [ ] **Step 2: Start local server**

Run:

```bash
npm run serve
```

Expected: server runs on `http://127.0.0.1:4173/`. Keep this terminal session running for browser QA.

- [ ] **Step 3: Browser QA normal flow**

Open:

```text
http://127.0.0.1:4173/?qa=1
```

Verify manually with the in-app browser:

- main screen renders without blank sprites;
- hero cards show passive names and descriptions;
- enemy side shows archetype name and trait text;
- pressing `Удар` shows HP changes and damage popup;
- passive event text appears when a passive triggers;
- reward choice appears after completing a special reward level;
- while reward choice is pending, fight buttons are disabled;
- choosing a reward adds a log entry and removes the panel;
- discounted upgrade label includes `зі знижкою`;
- QA controls still work.

- [ ] **Step 4: Browser QA mobile flow**

Use a mobile viewport around `390x844`.

Verify:

- reward panel does not overlap sticky quick actions;
- reward buttons are readable and easy to tap;
- passive/enemy badges stay inside their sprite cards;
- HP panels and damage popups do not overlap buttons;
- page scrolls to arena during attacks as before.

- [ ] **Step 5: Stop local server**

Stop the `npm run serve` process with `Ctrl-C`.

Expected: no local server is left running from this QA pass.

- [ ] **Step 6: Final git and diff checks**

Run:

```bash
git status --short
git diff --check
```

Expected: `git diff --check` prints no whitespace errors. `git status --short` shows only intentional changes if fixes were needed after the last commit.

- [ ] **Step 7: Commit final verification fixes if any**

If Step 6 shows intentional changes, run:

```bash
git add src test scripts
git commit -m "fix: polish tactical combat verification"
```

Expected: commit succeeds. If there were no changes, skip this commit.

## Plan Self-Review Checklist

- Spec coverage:
  - Hero passives: Task 2 and Task 4.
  - Enemy archetypes: Task 2 and Task 4.
  - Reward choices: Task 3 and Task 6.
  - Save compatibility: Task 1.
  - Smarter recommendations: Task 5.
  - UI and mobile UX: Task 6 and Task 7.
  - Security/edge cases: Task 1, Task 3, Task 4, Task 8.
  - Full verification: Task 8.
- Placeholder scan: this plan uses concrete file paths, function names, commands, assertions, and commit messages.
- Type consistency:
  - Reward ids are `bonus_coins`, `upgrade_discount`, `pity_token`, `next_damage`, `next_hp`.
  - Buff shape is `{ type: 'damage' | 'hp', percent: 10 }`.
  - Pending reward shape is `{ countryId, completedLevel, options }`.
  - Enemy archetype fields are `archetypeId`, `archetypeName`, `traitText`, `firstHitDamageMultiplier`.
  - Passive metadata comes from `getFighterPassive(fighterId)`.
