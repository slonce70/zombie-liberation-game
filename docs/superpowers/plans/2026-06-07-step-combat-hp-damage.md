# Step Combat HP Damage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-click level completion for regular enemies with tested step-by-step combat, visible HP bars, and synchronized damage popups.

**Architecture:** Keep persistent campaign state unchanged and add a non-persisted battle session for the current page lifetime. Pure combat rules live in `src/gameLogic.js`; `src/main.js` owns temporary UI phase state, rendering, sequencing, and save calls after stable campaign/log changes. Existing sprite states stay the animation contract.

**Tech Stack:** Static ES modules, browser DOM rendering, CSS animations, Node built-in test runner, existing smoke script, existing sprite validation scripts.

---

## File Structure

- Modify `src/gameLogic.js`: add pure battle-session helpers after `fightEnemy()` and before boss helpers; keep `fightEnemy()` as a legacy balance helper.
- Modify `test/gameLogic.test.js`: import the new helpers and add unit tests that lock step combat behavior before implementation.
- Modify `src/main.js`: remove `fightEnemy` from the UI path; add transient battle variables, HP/damage render helpers, async fight sequencing, active-battle clearing, and QA exposure.
- Modify `src/styles.css`: style HP panels, HP fill states, damage popups, and battle phase classes without breaking current responsive layout.
- Modify `scripts/smoke-check.mjs`: assert the new UI hooks and logic imports exist.
- No changes to `src/saveSystem.js`: `SAVE_VERSION` remains `1`; active battle is not serialized.
- No new dependencies.

## Task 1: Lock Step Combat Rules With Failing Unit Tests

**Files:**
- Modify: `test/gameLogic.test.js`
- Test: `test/gameLogic.test.js`

- [ ] **Step 1: Extend the imports in `test/gameLogic.test.js`**

Replace the import block with this exact block:

```js
import {
  createInitialState,
  getLevelReward,
  openMegaBox,
  upgradeFighter,
  completeLevel,
  isBossUnlocked,
  getBattleStats,
  fightEnemy,
  createBattleSession,
  applyHeroAttack,
  applyEnemyCounterAttack,
  getBattleOutcome,
  resolveBattleVictory,
} from '../src/gameLogic.js';
```

- [ ] **Step 2: Add failing tests after the existing starter-fighter battle test**

Append these tests at the end of `test/gameLogic.test.js`:

```js
test('step combat starts with full hero and enemy HP without mutating campaign', () => {
  const state = createInitialState();
  const beforeCoins = state.coins;
  const beforeLevel = state.countries[0].currentLevel;

  const result = createBattleSession(state, 'artem', 'ukraine');

  assert.equal(result.created, true);
  assert.equal(result.session.fighterId, 'artem');
  assert.equal(result.session.countryId, 'ukraine');
  assert.equal(result.session.countryLevel, 1);
  assert.equal(result.session.hero.currentHp, result.session.hero.maxHp);
  assert.equal(result.session.enemy.currentHp, result.session.enemy.maxHp);
  assert.equal(state.coins, beforeCoins);
  assert.equal(state.countries[0].currentLevel, beforeLevel);
});

test('first step attack only damages the enemy when damage is below enemy HP', () => {
  const state = createInitialState();
  const { session } = createBattleSession(state, 'artem', 'ukraine');

  const result = applyHeroAttack(session);

  assert.equal(result.damage, 34);
  assert.equal(result.session.enemy.currentHp, 38);
  assert.equal(result.session.hero.currentHp, 135);
  assert.equal(getBattleOutcome(result.session), 'ongoing');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});

test('enemy counterattack only happens while enemy is alive and can defeat hero without campaign progress', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;
  session = {
    ...session,
    hero: { ...session.hero, currentHp: 5 },
    enemy: { ...session.enemy, currentHp: 38 },
  };

  const result = applyEnemyCounterAttack(session);

  assert.equal(result.damage, 11);
  assert.equal(result.session.hero.currentHp, 0);
  assert.equal(result.session.enemy.currentHp, 38);
  assert.equal(getBattleOutcome(result.session), 'defeat');
  assert.equal(state.coins, 0);
  assert.equal(state.countries[0].currentLevel, 1);
});

test('step combat victory resolves the level exactly once', () => {
  const state = createInitialState();
  let session = createBattleSession(state, 'artem', 'ukraine').session;

  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;
  session = applyHeroAttack(session).session;

  assert.equal(session.enemy.currentHp, 0);
  assert.equal(getBattleOutcome(session), 'victory');

  const result = resolveBattleVictory(state, session, () => 0.99);
  assert.equal(result.completed, true);
  assert.equal(result.reward, 50);
  assert.equal(state.coins, 50);
  assert.equal(state.countries[0].currentLevel, 2);

  const duplicate = resolveBattleVictory(state, session, () => 0.99);
  assert.equal(duplicate.completed, false);
  assert.equal(duplicate.reason, 'stale_battle');
  assert.equal(state.coins, 50);
  assert.equal(state.countries[0].currentLevel, 2);
});

test('step combat rejects invalid, locked, freed, and stale battles without mutation', () => {
  const state = createInitialState();
  const locked = createBattleSession(state, 'sofia', 'ukraine');
  const missing = createBattleSession(state, 'artem', 'missing-country');

  assert.equal(locked.created, false);
  assert.equal(locked.reason, 'invalid_battle');
  assert.equal(missing.created, false);
  assert.equal(missing.reason, 'invalid_battle');

  state.countries[0].freed = true;
  const freed = createBattleSession(state, 'artem', 'ukraine');
  assert.equal(freed.created, false);
  assert.equal(freed.reason, 'invalid_battle');
});
```

- [ ] **Step 3: Run the targeted tests and confirm they fail for missing exports**

Run:

```bash
node --test test/gameLogic.test.js
```

Expected: FAIL with a module export error mentioning `createBattleSession` or another new helper.

- [ ] **Step 4: Commit the failing tests**

Run:

```bash
git add test/gameLogic.test.js
git commit -m "test: lock step combat rules"
```

Expected: commit succeeds with only `test/gameLogic.test.js` staged.

## Task 2: Implement Pure Battle Session Helpers

**Files:**
- Modify: `src/gameLogic.js`
- Test: `test/gameLogic.test.js`

- [ ] **Step 1: Add helper functions in `src/gameLogic.js` after `fightEnemy()`**

Insert this code after the closing brace of `fightEnemy()` and before `isBossUnlocked()`:

```js
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
  const damage = Math.max(0, next.hero.damage);
  next.enemy.currentHp = clampHp(next.enemy.currentHp - damage, next.enemy.maxHp);
  return { session: next, damage, target: 'enemy' };
}

export function applyEnemyCounterAttack(session) {
  const next = copyBattleSession(session);
  if (next.enemy.currentHp <= 0) {
    return { session: next, damage: 0, target: 'hero', skipped: true };
  }

  const damage = Math.max(0, next.enemy.damage);
  next.hero.currentHp = clampHp(next.hero.currentHp - damage, next.hero.maxHp);
  return { session: next, damage, target: 'hero' };
}

export function getBattleOutcome(session) {
  if (!session) return 'idle';
  if (session.enemy.currentHp <= 0) return 'victory';
  if (session.hero.currentHp <= 0) return 'defeat';
  return 'ongoing';
}

export function resolveBattleVictory(state, session, random = Math.random) {
  const country = findCountry(state, session?.countryId);
  if (
    !session
    || !country
    || country.freed
    || country.currentLevel !== session.countryLevel
    || getBattleOutcome(session) !== 'victory'
  ) {
    return { completed: false, reason: 'stale_battle' };
  }

  const progress = completeLevel(state, session.countryId, random);
  if (!progress.completed) return { completed: false, reason: progress.reason };

  return {
    completed: true,
    fighterName: session.fighterName,
    enemy: session.enemy,
    reward: progress.reward,
    progress,
  };
}
```

- [ ] **Step 2: Run the targeted unit tests**

Run:

```bash
node --test test/gameLogic.test.js
```

Expected: PASS for `test/gameLogic.test.js`.

- [ ] **Step 3: Run all unit tests**

Run:

```bash
npm test
```

Expected: all existing `test/*.test.js` files pass.

- [ ] **Step 4: Commit the pure logic implementation**

Run:

```bash
git add src/gameLogic.js test/gameLogic.test.js
git commit -m "feat: add step combat logic"
```

Expected: commit includes `src/gameLogic.js` plus the already committed test file only if it changed during fixes.

## Task 3: Wire Runtime Battle State Into The UI

**Files:**
- Modify: `src/main.js`
- Test: `scripts/smoke-check.mjs`

- [ ] **Step 1: Replace the `gameLogic.js` import in `src/main.js`**

Replace the import block at the top of `src/main.js` with:

```js
import {
  fightBoss,
  upgradeFighter,
  selectCountry,
  selectFighter,
  addLog,
  getBattleStats,
  getEnemyForLevel,
  getUpgradeCost,
  createBattleSession,
  applyHeroAttack,
  applyEnemyCounterAttack,
  getBattleOutcome,
  resolveBattleVictory,
  isBossUnlocked,
  LEVELS_PER_COUNTRY,
  MEGA_BOX_LEVEL,
  MAX_FIGHTER_LEVEL,
  PITY_TOKENS_FOR_UNLOCK,
} from './gameLogic.js';
```

- [ ] **Step 2: Replace battle globals after `lastBossAnimation`**

Replace:

```js
let lastBattleAnimation = null;
let lastBossAnimation = false;
```

with:

```js
const HERO_ATTACK_MS = 760;
const ENEMY_ATTACK_MS = 640;
const OUTCOME_PAUSE_MS = 360;

let lastBattleAnimation = null;
let lastBossAnimation = false;
let activeBattle = null;
let battlePhase = 'idle';
let lastDamagePopup = null;
let isBattleAnimating = false;
```

- [ ] **Step 3: Add runtime helpers after `currentFighter()`**

Insert:

```js
function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clearActiveBattle() {
  activeBattle = null;
  battlePhase = 'idle';
  lastDamagePopup = null;
  isBattleAnimating = false;
}

function battleMatches(fighter, country) {
  return Boolean(
    activeBattle
    && activeBattle.fighterId === fighter.id
    && activeBattle.countryId === country.id
    && activeBattle.countryLevel === country.currentLevel
  );
}

function hpPercent(currentHp, maxHp) {
  if (!Number.isFinite(currentHp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));
}

function hpTone(currentHp, maxHp) {
  const percent = hpPercent(currentHp, maxHp);
  if (percent <= 25) return 'low';
  if (percent <= 50) return 'mid';
  return 'high';
}

function renderHpPanel(label, combatant) {
  if (!combatant) return '<span class="sprite-stats">Обери іншу країну</span>';

  const currentHp = Math.max(0, Math.round(combatant.currentHp));
  const maxHp = Math.max(1, Math.round(combatant.maxHp));
  const damage = Math.max(0, Math.round(combatant.damage));
  const percent = hpPercent(currentHp, maxHp);
  const tone = hpTone(currentHp, maxHp);
  return `
    <span class="hp-panel" aria-label="${escapeHtml(label)} HP ${currentHp} з ${maxHp}">
      <span class="hp-meter" aria-hidden="true">
        <span class="hp-fill ${tone}" style="width:${percent}%"></span>
      </span>
      <span class="hp-text">HP ${currentHp}/${maxHp}</span>
      <span class="damage-line">Урон ${damage}</span>
    </span>
  `;
}

function renderDamagePopup(target) {
  if (!lastDamagePopup || lastDamagePopup.target !== target) return '';
  return `<span class="damage-popup target-${target}" aria-live="polite">-${lastDamagePopup.amount}</span>`;
}
```

- [ ] **Step 4: Update sprite state helpers**

Replace `heroSpriteState(country)` and `enemySpriteState(enemy)` with:

```js
function heroSpriteState(country) {
  if (battlePhase === 'hero-attack') return 'attack';
  if (battlePhase === 'enemy-attack') return 'hurt';
  if (battlePhase === 'victory' || state.bossDefeated || country.freed) return 'victory';
  return 'idle';
}

function enemySpriteState(enemy) {
  if (!enemy) return 'idle';
  if (battlePhase === 'hero-attack') return 'hurt';
  if (battlePhase === 'enemy-attack') return 'attack';
  return 'idle';
}
```

- [ ] **Step 5: Update battle data inside `render()` before `app.innerHTML`**

After `const enemyState = enemySpriteState(enemy);`, insert:

```js
  const inStepBattle = !bossOnStage && battleMatches(fighter, country);
  const heroCombatant = inStepBattle
    ? activeBattle.hero
    : { currentHp: stats.hp, maxHp: stats.hp, damage: stats.damage };
  const enemyCombatant = enemy
    ? inStepBattle
      ? activeBattle.enemy
      : { currentHp: enemy.hp, maxHp: enemy.hp, damage: enemy.damage }
    : null;
  const fightDisabled = country.freed || isBattleAnimating;
  const fightLabel = activeBattle ? '⚔️ Удар' : '⚔️ Битися з зомбі';
  const battlePhaseClass = battlePhase === 'idle' ? '' : `phase-${battlePhase}`;
```

- [ ] **Step 6: Replace the battle-stage markup in `render()`**

Replace the current battle stage block with:

```js
        <div class="battle-stage ${lastBattleAnimation ? 'battle-flash' : ''} ${battlePhaseClass}">
          <div class="sprite hero-sprite ${battlePhase === 'hero-attack' ? 'attacking' : ''} ${battlePhase === 'enemy-attack' ? 'hurt' : ''}" style="--accent:${fighter.color}">
            ${renderDamagePopup('hero')}
            ${animatedSpriteMarkup(fighterSprite, fighterState, fighterSprite.fallbackEmoji, 'battle-sprite')}
            <span class="sprite-name">${escapeHtml(fighter.name)}</span>
            ${renderHpPanel(fighter.name, heroCombatant)}
          </div>
          <div class="versus">VS</div>
          <div class="sprite zombie-sprite ${battlePhase === 'enemy-attack' ? 'attacking' : ''} ${battlePhase === 'hero-attack' ? 'hurt' : ''}">
            ${renderDamagePopup('enemy')}
            ${enemy ? animatedSpriteMarkup(enemySprite, enemyState, enemySprite.fallbackEmoji, 'battle-sprite') : '<span class="saved-mark" aria-hidden="true">✅</span>'}
            <span class="sprite-name">${enemy ? escapeHtml(enemy.name) : 'Врятовано!'}</span>
            ${enemy ? renderHpPanel(enemy.name, enemyCombatant) : '<span class="sprite-stats">Обери іншу країну</span>'}
          </div>
        </div>
```

- [ ] **Step 7: Replace the fight button line**

Replace:

```js
          <button class="primary" data-action="fight" ${country.freed ? 'disabled' : ''}>⚔️ Битися з зомбі</button>
```

with:

```js
          <button class="primary" data-action="fight" ${fightDisabled ? 'disabled' : ''}>${fightLabel}</button>
```

- [ ] **Step 8: Remove the automatic `lastBattleAnimation` timeout from `render()`**

Delete this block from the end of `render()`:

```js
  if (lastBattleAnimation) {
    window.setTimeout(() => {
      lastBattleAnimation = null;
      lastBossAnimation = false;
      render();
    }, 860);
  }
```

The new async handlers control phase clearing.

- [ ] **Step 9: Replace `handleFight()` with step-combat sequencing**

Replace the whole `handleFight()` function with:

```js
async function handleFight() {
  if (isBattleAnimating) return;

  const country = currentCountry();
  if (country.freed) return;

  if (!activeBattle || !battleMatches(currentFighter(), country)) {
    const created = createBattleSession(state, state.selectedFighterId, state.selectedCountryId);
    if (!created.created) {
      clearActiveBattle();
      addLog(state, 'Цей бій зараз недоступний. Обери відкритого бійця і країну з активним рівнем.');
      saveGame(storage, state);
      render();
      return;
    }
    activeBattle = created.session;
  }

  isBattleAnimating = true;
  battlePhase = 'hero-attack';
  const heroAttack = applyHeroAttack(activeBattle);
  activeBattle = heroAttack.session;
  lastBattleAnimation = 'hero';
  lastDamagePopup = { target: 'enemy', amount: heroAttack.damage };
  render();
  await wait(HERO_ATTACK_MS);

  if (getBattleOutcome(activeBattle) === 'victory') {
    battlePhase = 'victory';
    lastDamagePopup = null;
    render();
    await wait(OUTCOME_PAUSE_MS);

    const result = resolveBattleVictory(state, activeBattle);
    if (result.completed) {
      const { completedLevel, boxResult, country: completedCountry } = result.progress;
      addLog(state, `${result.fighterName} переміг ${result.enemy.name}: +${result.reward} монет!`);
      if (boxResult) addLog(state, `🎁 ${boxResult.message}`);
      if (completedCountry.freed) addLog(state, `✅ ${completedCountry.name} звільнено від зомбі!`);
      if (isBossUnlocked(state)) addLog(state, '👑 Усі 5 країн врятовано — фінальний бос відкритий!');
      if (completedLevel === 1) addLog(state, 'Перший рівень дав рівно 50 монет.');
    }

    clearActiveBattle();
    lastBattleAnimation = null;
    saveGame(storage, state);
    render();
    return;
  }

  battlePhase = 'enemy-attack';
  const enemyAttack = applyEnemyCounterAttack(activeBattle);
  activeBattle = enemyAttack.session;
  lastBattleAnimation = 'enemy';
  lastDamagePopup = { target: 'hero', amount: enemyAttack.damage };
  render();
  await wait(ENEMY_ATTACK_MS);

  if (getBattleOutcome(activeBattle) === 'defeat') {
    battlePhase = 'defeat';
    lastDamagePopup = null;
    addLog(state, 'Потрібна прокачка! Зароби монети або обери сильнішого бійця.');
    saveGame(storage, state);
    render();
    await wait(OUTCOME_PAUSE_MS);
    clearActiveBattle();
    lastBattleAnimation = null;
    render();
    return;
  }

  battlePhase = 'idle';
  lastBattleAnimation = null;
  lastDamagePopup = null;
  isBattleAnimating = false;
  render();
}
```

- [ ] **Step 10: Clear active battle in non-fight handlers**

Update handlers as follows:

```js
function handleBoss() {
  clearActiveBattle();
  const result = fightBoss(state, state.selectedFighterId);
  if (result.victory) {
    lastBattleAnimation = 'hero';
    lastBossAnimation = true;
    addLog(state, '🏆 Команда перемогла Зомбі-Боса Буль-Буля!');
  } else {
    lastBattleAnimation = 'enemy';
    addLog(state, 'Бос поки занадто сильний — прокачай бійців до вищих рівнів.');
  }
}

function handleUpgrade(fighterId) {
  clearActiveBattle();
  const result = upgradeFighter(state, fighterId);
  if (result.upgraded) {
    addLog(state, `${result.fighter.name} тепер рівня ${result.fighter.level}!`);
  } else if (result.reason === 'not_enough_coins') {
    addLog(state, `Потрібно ${result.cost} монет для прокачки.`);
  } else {
    addLog(state, 'Цього бійця зараз не можна прокачати.');
  }
}
```

At the start of each QA helper and reset helper, add `clearActiveBattle();`. For `handleReset()`, keep `lastBossAnimation = false;` after the clear:

```js
function handleReset() {
  Object.assign(state, resetGame(storage));
  clearActiveBattle();
  lastBossAnimation = false;
  addLog(state, 'Збереження очищено. Пригода починається спочатку!');
}
```

- [ ] **Step 11: Update the click listener so fight owns its async render/save flow**

Replace the click listener with:

```js
app.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.dataset.action === 'fight') {
    void handleFight();
    return;
  }

  if (target.dataset.country) {
    clearActiveBattle();
    selectCountry(state, target.dataset.country);
  }
  if (target.dataset.fighter) {
    clearActiveBattle();
    selectFighter(state, target.dataset.fighter);
  }
  if (target.dataset.upgrade) handleUpgrade(target.dataset.upgrade);
  if (target.dataset.action === 'boss') handleBoss();
  if (target.dataset.action === 'reset-save') handleReset();
  if (target.dataset.action === 'dev-level10') devLevel10();
  if (target.dataset.action === 'dev-free-country') devFreeCountry();
  if (target.dataset.action === 'dev-free-all') devFreeAllCountries();
  if (target.dataset.action === 'dev-max-fighters') devMaxFighters();

  saveGame(storage, state);
  render();
});
```

- [ ] **Step 12: Update QA globals**

In `syncQaGlobals()`, add `clearActiveBattle` and expose a readonly active battle getter:

```js
  window.__zombieGameActions = {
    render,
    clearActiveBattle,
    devLevel10,
    devFreeCountry,
    devFreeAllCountries,
    devMaxFighters,
    handleFight,
    handleBoss,
    handleReset,
  };
  window.__zombieGameBattle = () => activeBattle;
```

- [ ] **Step 13: Run syntax checks**

Run:

```bash
node --check src/main.js
node --check src/gameLogic.js
```

Expected: both commands exit with code `0` and no syntax errors.

- [ ] **Step 14: Commit UI wiring**

Run:

```bash
git add src/main.js
git commit -m "feat: wire step combat UI state"
```

Expected: commit includes `src/main.js`.

## Task 4: Add HP And Damage Styling Plus Smoke Checks

**Files:**
- Modify: `src/styles.css`
- Modify: `scripts/smoke-check.mjs`
- Test: `scripts/smoke-check.mjs`

- [ ] **Step 1: Add HP and damage CSS after `.sprite-stats`**

Insert this block after the existing `.sprite-stats` rule:

```css
.hp-panel {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 4px;
  width: min(190px, 86%);
  padding: 7px 9px;
  border-radius: 14px;
  background: rgba(255,255,255,.72);
  color: var(--muted);
  font-size: .78rem;
  font-weight: 900;
}
.hp-meter {
  display: block;
  width: 100%;
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: #dfe7f3;
  box-shadow: inset 0 2px 5px rgba(28,45,86,.16);
}
.hp-fill {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  transition: width 220ms ease;
}
.hp-fill.high { background: linear-gradient(90deg, #25b66c, #72ec93); }
.hp-fill.mid { background: linear-gradient(90deg, #f2b84b, #ffe772); }
.hp-fill.low { background: linear-gradient(90deg, #ff4f7b, #ff8b38); }
.hp-text, .damage-line {
  display: block;
  line-height: 1.1;
  text-align: center;
}
.damage-line {
  color: #394869;
  font-size: .72rem;
}
.damage-popup {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 4;
  min-width: 54px;
  transform: translateX(-50%);
  border-radius: 999px;
  padding: 5px 10px;
  background: #fff;
  color: #ff315f;
  font-size: 1.35rem;
  font-weight: 1000;
  line-height: 1;
  box-shadow: 0 8px 0 rgba(255,49,95,.18), 0 14px 24px rgba(48,65,110,.18);
  animation: damageFloat 760ms ease-out 1;
  pointer-events: none;
}
.battle-stage.phase-hero-attack,
.battle-stage.phase-enemy-attack {
  outline: 4px solid rgba(255,255,255,.72);
}
.battle-stage.phase-victory {
  outline: 4px solid rgba(121,240,156,.75);
}
.battle-stage.phase-defeat {
  outline: 4px solid rgba(255,122,60,.62);
}
```

- [ ] **Step 2: Add the damage animation after `@keyframes petHurt`**

Insert:

```css
@keyframes damageFloat {
  0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.84); }
  18% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.08); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(.96); }
}
```

- [ ] **Step 3: Add mobile constraints inside the existing `@media (max-width: 880px)` block**

Add these rules before the closing brace of the media block:

```css
  .hp-panel { width: min(220px, 92%); }
  .damage-popup { top: 12px; font-size: 1.2rem; }
```

- [ ] **Step 4: Extend `prefers-reduced-motion` behavior**

Inside the existing `@media (prefers-reduced-motion: reduce)` block, after the universal rule, add:

```css
  .damage-popup {
    animation: none !important;
    opacity: 1;
    transform: translateX(-50%);
  }
```

- [ ] **Step 5: Add smoke assertions**

In `scripts/smoke-check.mjs`, after the existing main assertions, add:

```js
assert.match(main, /createBattleSession/);
assert.match(main, /applyHeroAttack/);
assert.match(main, /applyEnemyCounterAttack/);
assert.match(main, /resolveBattleVictory/);
assert.match(main, /activeBattle/);
assert.match(main, /isBattleAnimating/);
assert.match(main, /renderHpPanel/);
assert.match(main, /renderDamagePopup/);
assert.match(main, /__zombieGameBattle/);
```

After the existing CSS assertions, add:

```js
assert.match(css, /\.hp-panel/);
assert.match(css, /\.hp-meter/);
assert.match(css, /\.hp-fill/);
assert.match(css, /\.damage-popup/);
assert.match(css, /@keyframes damageFloat/);
assert.match(css, /\.battle-stage\.phase-hero-attack/);
assert.match(css, /\.battle-stage\.phase-enemy-attack/);
```

- [ ] **Step 6: Run smoke check**

Run:

```bash
npm run smoke
```

Expected: PASS and prints `Smoke check passed...`.

- [ ] **Step 7: Commit CSS and smoke checks**

Run:

```bash
git add src/styles.css scripts/smoke-check.mjs
git commit -m "feat: add combat hp damage visuals"
```

Expected: commit includes only CSS and smoke script changes.

## Task 5: Full Verification And Manual QA

**Files:**
- Read: `package.json`
- Verify: app in browser at local server URL

- [ ] **Step 1: Run the full verification script**

Run:

```bash
npm run verify
```

Expected: all checks pass:

- `node --check src/main.js`
- `node --check src/gameLogic.js`
- `node --check src/spriteCatalog.js`
- Python script compilation
- `npm test`
- `npm run sprites:validate`
- `npm run smoke`

- [ ] **Step 2: Start the local app server**

Run:

```bash
npm run serve
```

Expected: server prints that it is serving on port `4173`. Keep it running for browser QA.

- [ ] **Step 3: Open the app with QA mode**

Open:

```text
http://localhost:4173/?qa
```

Expected: app loads, QA buttons are visible, no console-breaking blank screen.

- [ ] **Step 4: Verify first-hit behavior manually**

In the app:

1. Reset save.
2. Confirm selected fighter is Артем and selected country is Україна level 1.
3. Click `Битися з зомбі`.
4. Observe the enemy HP panel.

Expected:

- Button text changes to `Удар` while a battle is active.
- Damage popup `-34` appears above the zombie.
- Zombie HP changes from `72/72` to `38/72`.
- Coins remain `0`.
- Country remains level `1`.
- The level is not completed after the first click.

- [ ] **Step 5: Verify enemy counterattack manually**

Continue from the same first-hit state.

Expected:

- Zombie performs attack after the hero attack.
- Damage popup `-11` appears above the hero.
- Hero HP changes from `135/135` to `124/135`.
- Button becomes available again after the animation phase.

- [ ] **Step 6: Verify victory manually**

Click `Удар` until the zombie reaches `0` HP.

Expected:

- Coins become `50`.
- Україна advances to level `2`.
- Log contains the victory message.
- Active battle clears, so the next enemy displays full HP for level `2`.
- Reward is added once.

- [ ] **Step 7: Verify active battle clearing manually**

Start a new fight, then select another country or fighter.

Expected:

- Active HP state resets.
- New selected country/fighter does not show the previous battle HP.
- `window.__zombieGameBattle()` returns `null` in QA mode after the selection.

- [ ] **Step 8: Verify reload behavior manually**

Start a new fight, make one hit, then reload the page.

Expected:

- Campaign save persists.
- Active battle does not persist.
- Enemy for the current country/level displays full HP.
- `window.__zombieGameBattle()` returns `null`.

- [ ] **Step 9: Verify defeat path with QA or console setup**

In QA mode, use the console only for this setup:

```js
const state = window.__zombieGameState;
state.fighters.find((fighter) => fighter.id === 'artem').level = 1;
state.countries.find((country) => country.id === 'ukraine').currentLevel = 25;
window.__zombieGameActions.render();
```

Then fight until the hero loses.

Expected:

- Log says the player needs an upgrade or stronger fighter.
- Coins do not increase.
- Country level remains `25`.
- Active battle clears.

- [ ] **Step 10: Stop the local server**

Stop `npm run serve` with `Ctrl-C`.

Expected: terminal returns to prompt.

- [ ] **Step 11: Commit any verification-only fixes**

If manual QA revealed a fix, commit it with a narrow message:

```bash
git add src/main.js src/styles.css scripts/smoke-check.mjs test/gameLogic.test.js src/gameLogic.js
git commit -m "fix: harden step combat edge cases"
```

Expected: commit only occurs if a real fix was made. If no fix was made, skip this commit.

- [ ] **Step 12: Final status check**

Run:

```bash
git status --short
```

Expected: no uncommitted source changes. If the local server was stopped cleanly, no running terminal session remains.

## Self-Review Notes

- Spec coverage: pure step combat rules are covered in Tasks 1-2; visual HP and damage are covered in Tasks 3-4; edge cases and no-save active battle behavior are covered in Tasks 3 and 5; verification commands match the spec.
- Placeholder scan: every task names exact files, commands, expected output, and concrete code snippets.
- Type consistency: the session shape uses `hero.currentHp`, `hero.maxHp`, `hero.damage`, `enemy.currentHp`, `enemy.maxHp`, `enemy.damage`, `fighterId`, `countryId`, and `countryLevel` consistently across tests, logic, and UI.
