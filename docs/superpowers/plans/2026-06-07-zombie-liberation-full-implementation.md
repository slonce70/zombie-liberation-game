# Zombie Liberation Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing playable MVP into a complete V1 kid-friendly browser game with durable progress, a full 5-country campaign, safer battle balance, better UI states, and a hatch-pet-inspired sprite asset path.

**Architecture:** Keep the project dependency-free and static. Split responsibilities into focused modules: immutable-ish state transitions in `src/gameLogic.js`, save/load in `src/saveSystem.js`, campaign/balance helpers in `src/campaign.js`, rendering/event wiring in `src/main.js`, and visual tokens/sprite metadata in `src/spriteCatalog.js`. Tests stay on Node's built-in test runner and cover every gameplay rule before UI wiring.

**Tech Stack:** Vanilla HTML/CSS/JavaScript ES modules, Node built-in `node:test`, browser `localStorage`, generated PNG/WebP assets stored under `assets/`, Python `http.server` for local QA.

---

## Current baseline

The current project already has:
- `src/gameData.js` with five countries, five fighters, boss constants, level constants, Mega Box chance, and pity tokens.
- `src/gameLogic.js` with state transitions for battle, upgrades, Mega Boxes, country completion, boss unlock, and boss battle.
- `src/main.js` rendering the game and gating QA controls behind `?qa=1`.
- `src/styles.css` with kid-friendly layout, top-right map, animated sprite tokens, responsive layout, and reduced-motion support.
- `test/gameLogic.test.js` and `test/adversarialGame.test.js` with 13 passing tests.
- `assets/concept/zombie-liberation-concept.png` as the ImageGen art direction reference.

## Target file structure

- Modify `src/gameData.js`: add campaign copy, level themes, achievement data, and unlock labels.
- Modify `src/gameLogic.js`: expose deterministic state transitions that can save/load cleanly.
- Create `src/saveSystem.js`: serialize, validate, migrate, reset, and load progress from `localStorage`.
- Create `src/campaign.js`: derive campaign status, next recommended action, and country progress summaries.
- Create `src/spriteCatalog.js`: describe hatch-pet-like animation states and asset paths for fighters/zombies/boss.
- Modify `src/main.js`: use save system, campaign helpers, sprite catalog, better disabled states, and save/reset controls.
- Modify `src/styles.css`: add campaign progress polish, save/reset UI, sprite state classes, and mobile improvements.
- Create `test/saveSystem.test.js`: save/load/migration/corruption tests.
- Create `test/campaign.test.js`: campaign summary and next-action tests.
- Create `test/balance.test.js`: worst-case campaign/boss balance tests.
- Create `docs/art/sprite-generation-prompts.md`: exact ImageGen/hatch-pet-style prompts for base art and animation states.
- Create `docs/qa/full-v1-checklist.md`: manual and automated QA checklist.

---

### Task 1: Save system with validation and migration

**Files:**
- Create: `src/saveSystem.js`
- Create: `test/saveSystem.test.js`
- Modify: `src/gameLogic.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write the failing save/load test**

Create `test/saveSystem.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryStorage,
  loadGame,
  saveGame,
  resetGame,
  SAVE_KEY,
  SAVE_VERSION,
} from '../src/saveSystem.js';
import { createInitialState, completeLevel, upgradeFighter } from '../src/gameLogic.js';

test('saveGame and loadGame preserve coins, countries, fighters, pity tokens, and boss state', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.coins = 999;
  state.pityTokens = 1;
  completeLevel(state, 'ukraine', () => 0.99);
  upgradeFighter(state, 'artem');
  state.bossDefeated = true;

  saveGame(storage, state);
  const loaded = loadGame(storage);

  assert.equal(storage.getItem(SAVE_KEY).includes(`"version":${SAVE_VERSION}`), true);
  assert.equal(loaded.coins, state.coins);
  assert.equal(loaded.pityTokens, 1);
  assert.equal(loaded.countries[0].currentLevel, 2);
  assert.equal(loaded.fighters[0].level, 2);
  assert.equal(loaded.bossDefeated, true);
});

test('loadGame returns a fresh initial state when save data is corrupted', () => {
  const storage = createMemoryStorage();
  storage.setItem(SAVE_KEY, '{broken json');

  const loaded = loadGame(storage);

  assert.equal(loaded.coins, 0);
  assert.equal(loaded.selectedCountryId, 'ukraine');
  assert.equal(loaded.selectedFighterId, 'artem');
});

test('resetGame removes saved progress and returns initial state', () => {
  const storage = createMemoryStorage();
  const state = createInitialState();
  state.coins = 500;
  saveGame(storage, state);

  const reset = resetGame(storage);

  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(reset.coins, 0);
});
```

- [ ] **Step 2: Run the save test to verify RED**

Run:

```bash
node --test test/saveSystem.test.js
```

Expected: FAIL with `Cannot find module ... src/saveSystem.js`.

- [ ] **Step 3: Implement `src/saveSystem.js`**

Create `src/saveSystem.js`:

```js
import { createInitialState } from './gameLogic.js';

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

  const byCountry = new Map((rawState.countries || []).map((country) => [country.id, country]));
  const byFighter = new Map((rawState.fighters || []).map((fighter) => [fighter.id, fighter]));

  return {
    ...initial,
    coins: Number.isFinite(rawState.coins) ? Math.max(0, rawState.coins) : initial.coins,
    pityTokens: Number.isFinite(rawState.pityTokens) ? Math.max(0, rawState.pityTokens) : initial.pityTokens,
    selectedCountryId: typeof rawState.selectedCountryId === 'string' ? rawState.selectedCountryId : initial.selectedCountryId,
    selectedFighterId: typeof rawState.selectedFighterId === 'string' ? rawState.selectedFighterId : initial.selectedFighterId,
    bossDefeated: rawState.bossDefeated === true,
    log: Array.isArray(rawState.log) ? rawState.log.slice(0, 8).map(String) : initial.log,
    countries: initial.countries.map((country) => ({
      ...country,
      ...byCountry.get(country.id),
      currentLevel: clampInteger(byCountry.get(country.id)?.currentLevel, 1, 25, country.currentLevel),
      freed: byCountry.get(country.id)?.freed === true,
      megaBoxClaimed: byCountry.get(country.id)?.megaBoxClaimed === true,
    })),
    fighters: initial.fighters.map((fighter) => ({
      ...fighter,
      ...byFighter.get(fighter.id),
      level: clampInteger(byFighter.get(fighter.id)?.level, 1, 10, fighter.level),
      unlocked: byFighter.get(fighter.id)?.unlocked === true || fighter.unlocked,
    })),
  };
}

function clampInteger(value, min, max, fallback) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function saveGame(storage, state) {
  storage.setItem(SAVE_KEY, serializeGame(state));
}

export function loadGame(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION) return hydrateState(parsed.state);
    return hydrateState(parsed.state);
  } catch {
    return createInitialState();
  }
}

export function resetGame(storage) {
  storage.removeItem(SAVE_KEY);
  return createInitialState();
}
```

- [ ] **Step 4: Run save tests to verify GREEN**

Run:

```bash
node --test test/saveSystem.test.js
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Wire save/load into `src/main.js`**

Modify imports in `src/main.js`:

```js
import { loadGame, resetGame, saveGame } from './saveSystem.js';
```

Replace:

```js
const state = createInitialState();
```

with:

```js
const storage = window.localStorage;
const state = loadGame(storage);
```

After every action before `render();`, add:

```js
saveGame(storage, state);
```

Add reset handling in the click listener:

```js
if (target.dataset.action === 'reset-save') {
  Object.assign(state, resetGame(storage));
  addLog(state, 'Збереження очищено. Пригода починається спочатку!');
}
```

Add a button inside `.actions`:

```html
<button data-action="reset-save">🔄 Нова гра</button>
```

- [ ] **Step 6: Run full tests**

Run:

```bash
npm test
npm run smoke
```

Expected: all tests pass and smoke check passes.

---

### Task 2: Campaign helper module and richer country progress

**Files:**
- Create: `src/campaign.js`
- Create: `test/campaign.test.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing campaign tests**

Create `test/campaign.test.js`:

```js
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
```

- [ ] **Step 2: Run campaign tests to verify RED**

Run:

```bash
node --test test/campaign.test.js
```

Expected: FAIL with `Cannot find module ... src/campaign.js`.

- [ ] **Step 3: Implement `src/campaign.js`**

Create `src/campaign.js`:

```js
import { getBattleStats, getEnemyForLevel, isBossUnlocked, LEVELS_PER_COUNTRY, MEGA_BOX_LEVEL } from './gameLogic.js';

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
  if (isBossUnlocked(state)) return { kind: 'boss', message: 'Фінальний бос відкритий — спробуй командну битву!' };

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
```

- [ ] **Step 4: Run campaign tests to verify GREEN**

Run:

```bash
node --test test/campaign.test.js
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Render campaign summary in `src/main.js`**

Add import:

```js
import { getCampaignSummary, getCountryProgress, getNextRecommendation } from './campaign.js';
```

Inside `render()`, add:

```js
const summary = getCampaignSummary(state);
const recommendation = getNextRecommendation(state);
```

Add a recommendation panel below status row:

```html
<section class="recommendation ${recommendation.kind}">
  <strong>Підказка:</strong> ${escapeHtml(recommendation.message)}
</section>
```

Replace map node internals with `getCountryProgress(country)` values:

```js
const progress = getCountryProgress(country);
return `
  <button class="map-node ${selected} ${status}" data-country="${country.id}" title="${escapeHtml(country.name)}">
    <span>${country.icon}</span>
    <small>${progress.percent}%</small>
  </button>
`;
```

- [ ] **Step 6: Style campaign summary**

Add to `src/styles.css`:

```css
.recommendation {
  margin: -4px 0 16px;
  padding: 14px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 12px 32px rgba(48,65,110,.12);
  font-weight: 850;
}
.recommendation.upgrade { background: #fff1c7; }
.recommendation.boss { background: #ffd5f1; }
```

- [ ] **Step 7: Run full tests and smoke**

Run:

```bash
npm test
npm run smoke
```

Expected: all tests pass and smoke check passes.

---

### Task 3: Battle balance simulation and boss guarantee

**Files:**
- Create: `test/balance.test.js`
- Modify: `src/gameLogic.js`
- Modify: `src/gameData.js`

- [ ] **Step 1: Write failing/guard balance tests**

Create `test/balance.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  fightBoss,
  openMegaBox,
  upgradeFighter,
  isBossUnlocked,
} from '../src/gameLogic.js';

test('worst-case five country boxes unlock enough fighters for final boss after upgrades', () => {
  const state = createInitialState();
  for (let i = 0; i < 5; i += 1) openMegaBox(state, () => 0.99);
  state.fighters.filter((fighter) => fighter.unlocked).forEach((fighter) => { fighter.level = 10; });
  state.countries.forEach((country) => { country.freed = true; });

  assert.equal(isBossUnlocked(state), true);
  assert.equal(state.fighters.filter((fighter) => fighter.unlocked).length >= 3, true);
  assert.equal(fightBoss(state, 'artem').victory, true);
});

test('upgrade cost curve lets a player upgrade starter after several early wins', () => {
  const state = createInitialState();
  state.coins = 50 + 58 + 66;

  const result = upgradeFighter(state, 'artem');

  assert.equal(result.upgraded, true);
  assert.equal(state.fighters[0].level, 2);
});
```

- [ ] **Step 2: Run balance tests**

Run:

```bash
node --test test/balance.test.js
```

Expected: PASS if current pity/boss/cost balance is already correct; FAIL if a future change reintroduces soft-lock or too-expensive early upgrades.

- [ ] **Step 3: If balance test fails, adjust constants only**

Allowed edits in `src/gameData.js`:

```js
export const PITY_TOKENS_FOR_UNLOCK = 2;
```

Allowed edits in `src/gameLogic.js`:

```js
export function getUpgradeCost(fighterLevel) {
  if (fighterLevel >= MAX_FIGHTER_LEVEL) return Infinity;
  return 70 + fighterLevel * 35;
}
```

Do not add random hidden buffs. Balance must remain visible through tests.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run smoke
```

Expected: all tests pass and smoke check passes.

---

### Task 4: Hatch-pet-inspired sprite catalog and generated art prompts

**Files:**
- Create: `src/spriteCatalog.js`
- Create: `test/spriteCatalog.test.js`
- Create: `docs/art/sprite-generation-prompts.md`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Optional generated assets: `assets/sprites/fighters/*.webp`, `assets/sprites/zombies/*.webp`, `assets/sprites/boss/*.webp`

- [ ] **Step 1: Write failing sprite catalog tests**

Create `test/spriteCatalog.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpriteForEntity, spriteStates, spriteStyleRules } from '../src/spriteCatalog.js';

test('sprite catalog defines hatch-pet-like states for every fighter and enemy type', () => {
  assert.deepEqual(spriteStates, ['idle', 'attack', 'victory', 'hurt']);
  assert.equal(getSpriteForEntity('artem').name, 'Артем Блискавка');
  assert.equal(getSpriteForEntity('zombie').states.idle.includes('idle'), true);
  assert.equal(getSpriteForEntity('boss').states.attack.includes('attack'), true);
});

test('sprite style rules forbid gore, detached effects, and readable logos', () => {
  assert.match(spriteStyleRules.avoid, /blood|gore|logos|detached effects/i);
  assert.match(spriteStyleRules.style, /kid-friendly/i);
});
```

- [ ] **Step 2: Run sprite tests to verify RED**

Run:

```bash
node --test test/spriteCatalog.test.js
```

Expected: FAIL with `Cannot find module ... src/spriteCatalog.js`.

- [ ] **Step 3: Implement `src/spriteCatalog.js`**

Create `src/spriteCatalog.js`:

```js
export const spriteStates = ['idle', 'attack', 'victory', 'hurt'];

export const spriteStyleRules = {
  style: 'kid-friendly colorful 2D game sprites, compact hatch-pet-like silhouettes, readable at small size',
  avoid: 'blood, gore, horror, readable logos, copyrighted characters, detached effects, shadows, smoke clouds, speed lines',
};

const catalog = {
  artem: makeFighter('artem', 'Артем Блискавка', '⚡'),
  sofia: makeFighter('sofia', 'Софія Щит', '🛡️'),
  maks: makeFighter('maks', 'Макс Ракета', '🚀'),
  lina: makeFighter('lina', 'Ліна Іскра', '✨'),
  danylo: makeFighter('danylo', 'Данило Лев', '🦁'),
  zombie: makeEnemy('zombie', 'Веселий зомбі', '🧟'),
  boss: makeEnemy('boss', 'Зомбі-Бос Буль-Буль', '🧟‍♂️'),
};

function makeFighter(id, name, fallbackEmoji) {
  return {
    id,
    name,
    fallbackEmoji,
    states: Object.fromEntries(spriteStates.map((state) => [state, `assets/sprites/fighters/${id}-${state}.webp`])),
  };
}

function makeEnemy(id, name, fallbackEmoji) {
  return {
    id,
    name,
    fallbackEmoji,
    states: Object.fromEntries(spriteStates.map((state) => [state, `assets/sprites/zombies/${id}-${state}.webp`])),
  };
}

export function getSpriteForEntity(id) {
  return catalog[id] || catalog.zombie;
}
```

- [ ] **Step 4: Write exact generation prompts**

Create `docs/art/sprite-generation-prompts.md`:

```markdown
# Sprite Generation Prompts

Use ImageGen first. These prompts are for individual transparent or chroma-key assets; use hatch-pet constraints: compact whole-body silhouette, consistent identity, no gore, no readable logos, no detached effects.

## Fighter base prompt template
Create a kid-friendly 2D game sprite for `<fighter name>`, a compact heroic character with `<emoji/theme cue>` energy. Full body, centered, readable silhouette, bright mobile-game colors, no text, no logos, no gore, no horror. Flat solid chroma-key background, no shadows, no scenery.

## Fighter states
- idle: calm breathing pose, tiny bounce, same silhouette.
- attack: clear action pose, no impact burst, no detached effect.
- victory: happy pose, no confetti or floating symbols.
- hurt: surprised but safe cartoon reaction, no wounds, no tears detached from face.

## Zombie prompt
Create a silly non-scary zombie minion for a child-friendly 2D game. Cute awkward pose, greenish playful palette, no blood, no gore, no horror, no text, no logos, flat chroma-key background.

## Boss prompt
Create a large silly zombie boss named Зомбі-Бос Буль-Буль for a child-friendly 2D game. Big round silhouette, goofy expression, playful not frightening, no blood, no gore, no horror, no text, no logos, flat chroma-key background.
```

- [ ] **Step 5: Wire sprite catalog fallback into `src/main.js`**

Add import:

```js
import { getSpriteForEntity } from './spriteCatalog.js';
```

Inside `render()`, add:

```js
const fighterSprite = getSpriteForEntity(fighter.id);
const enemySprite = getSpriteForEntity(enemy ? 'zombie' : 'zombie');
```

In the hero sprite emoji span, use:

```html
<span class="sprite-emoji" data-sprite="${fighterSprite.states.idle}">${fighterSprite.fallbackEmoji}</span>
```

In the zombie sprite emoji span, use:

```html
<span class="sprite-emoji" data-sprite="${enemySprite.states.idle}">${enemy ? enemySprite.fallbackEmoji : '✅'}</span>
```

- [ ] **Step 6: Add sprite CSS hooks**

Add to `src/styles.css`:

```css
.sprite.attacking { animation: petAttack 360ms ease-in-out 1; }
@keyframes petAttack {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-5px) translateX(8px) scale(1.04); }
}
```

- [ ] **Step 7: Run sprite and full tests**

Run:

```bash
node --test test/spriteCatalog.test.js
npm test
npm run smoke
```

Expected: all tests pass and smoke check passes.

---

### Task 5: Player-facing campaign polish and child-friendly copy

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Create: `test/copySafety.test.js`

- [ ] **Step 1: Write copy safety test**

Create `test/copySafety.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { countries, fighters, boss } from '../src/gameData.js';

const banned = /blood|gore|kill|murder|жах|кров|вбив/iu;

test('game data copy stays kid-friendly and non-gory', () => {
  const copy = [
    ...countries.map((country) => `${country.name} ${country.icon}`),
    ...fighters.map((fighter) => `${fighter.name} ${fighter.role} ${fighter.unlockText}`),
    `${boss.name} ${boss.emoji}`,
  ].join(' ');

  assert.equal(banned.test(copy), false);
});
```

- [ ] **Step 2: Run copy safety test**

Run:

```bash
node --test test/copySafety.test.js
```

Expected: PASS; if it fails, replace unsafe words with playful rescue/adventure wording.

- [ ] **Step 3: Add country chapter blurbs to `src/gameData.js`**

For each country object, add a `chapter` field:

```js
{ id: 'ukraine', name: 'Україна', icon: '🌻', color: '#3f8cff', chapter: 'Соняшникові поля чекають на команду рятівників.' }
```

Use these exact chapter strings:

```js
'Соняшникові поля чекають на команду рятівників.'
'Міські площі кличуть героїв на веселу оборону.'
'Сакура підказує шлях до наступного Мегабокса.'
'Джунглі шумлять: зомбі заблукали серед пальм.'
'Піраміди сховали фінальний ключ до боса.'
```

- [ ] **Step 4: Render chapter text in country banner**

In `src/main.js`, inside `.country-banner`, after the level paragraph add:

```html
<p class="chapter-copy">${escapeHtml(country.chapter)}</p>
```

- [ ] **Step 5: Style chapter copy**

Add to `src/styles.css`:

```css
.chapter-copy {
  margin-top: 4px !important;
  opacity: 0.86;
  font-size: 0.92rem;
  font-weight: 750;
}
```

- [ ] **Step 6: Run full verification**

Run:

```bash
npm test
npm run smoke
```

Expected: all tests pass and smoke check passes.

---

### Task 6: Final V1 QA checklist and run instructions

**Files:**
- Create: `docs/qa/full-v1-checklist.md`
- Modify: `assets/README.md`
- Modify: `package.json`

- [ ] **Step 1: Add a QA checklist document**

Create `docs/qa/full-v1-checklist.md`:

```markdown
# Zombie Liberation V1 QA Checklist

## Automated
- `node --check src/main.js`
- `node --check src/gameLogic.js`
- `npm test`
- `npm run smoke`

## Manual normal path
1. Open `http://127.0.0.1:4173`.
2. Confirm the top-right map shows 5 countries.
3. Fight level 1 and confirm coins become 50.
4. Upgrade Артем after enough coins.
5. Reach level 10 in `?qa=1` mode and confirm Mega Box behavior.
6. Free all 5 countries in `?qa=1` mode and confirm boss unlocks.
7. Fight boss with upgraded fighters and confirm victory log.

## Manual safety path
- Confirm no blood/gore/horror copy is visible.
- Confirm QA buttons are hidden without `?qa=1`.
- Confirm reduced-motion mode does not rely on animation to understand the game.
- Confirm reset starts a clean game.
```

- [ ] **Step 2: Add package script for full verification**

Modify `package.json` scripts:

```json
{
  "test": "node --test test/*.test.js",
  "smoke": "node scripts/smoke-check.mjs",
  "verify": "node --check src/main.js && node --check src/gameLogic.js && npm test && npm run smoke",
  "serve": "python3 -m http.server 4173"
}
```

- [ ] **Step 3: Update `assets/README.md` with sprite policy**

Append:

```markdown
## Sprite policy

Generated fighter/zombie sprites should follow `docs/art/sprite-generation-prompts.md` and remain kid-safe: no blood, no gore, no scary horror, no copied characters, no readable logos. If generated sprites are not available, the game uses emoji/CSS sprite tokens as a safe fallback.
```

- [ ] **Step 4: Run final verification**

Run:

```bash
npm run verify
```

Expected: syntax checks pass, all tests pass, smoke check passes.

---

## Self-review checklist

- Spec coverage: this plan covers save/load, campaign progress, balance, sprite generation path, copy safety, UI polish, and QA.
- Placeholder scan: no banned placeholder phrases, no open-ended implementation gaps, no “write tests for this” without concrete tests.
- Type consistency: modules consistently use `state`, `country`, `fighter`, `spriteStates`, `SAVE_KEY`, `SAVE_VERSION`, and `PITY_TOKENS_FOR_UNLOCK`.
- Scope: this is a single V1 static-browser-game implementation plan. Full custom generated sprite atlases can be executed as a separate asset-production pass if desired, but this plan creates the code hooks and exact prompts first.
