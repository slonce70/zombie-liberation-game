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
import { getCampaignSummary, getCountryProgress, getNextRecommendation } from './campaign.js';
import { loadGame, resetGame, saveGame } from './saveSystem.js';
import { boss as bossData } from './gameData.js';
import { getSpriteForEntity, spriteStates } from './spriteCatalog.js';

const app = document.querySelector('#app');
const storage = window.localStorage;
const state = loadGame(storage);
const qaMode = new URLSearchParams(window.location.search).has('qa');
const HERO_ATTACK_MS = 760;
const ENEMY_ATTACK_MS = 640;
const OUTCOME_PAUSE_MS = 360;

let lastBattleAnimation = null;
let lastBossAnimation = false;
let activeBattle = null;
let battlePhase = 'idle';
let lastDamagePopup = null;
let isBattleAnimating = false;
let battleToken = 0;
let actionNotice = null;
const spriteLoadStates = new Map();

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function currentCountry() {
  return state.countries.find((country) => country.id === state.selectedCountryId) || state.countries[0];
}

function currentFighter() {
  return state.fighters.find((fighter) => fighter.id === state.selectedFighterId && fighter.unlocked)
    || state.fighters.find((fighter) => fighter.unlocked)
    || state.fighters[0];
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clearActiveBattle() {
  battleToken += 1;
  activeBattle = null;
  battlePhase = 'idle';
  lastBattleAnimation = null;
  lastBossAnimation = false;
  lastDamagePopup = null;
  isBattleAnimating = false;
  actionNotice = null;
}

function setActionNotice(kind, message) {
  actionNotice = { kind, message };
}

function clearActionNotice() {
  actionNotice = null;
}

function battleMatches(fighter, country) {
  return Boolean(
    activeBattle
    && activeBattle.fighterId === fighter.id
    && activeBattle.countryId === country.id
    && activeBattle.countryLevel === country.currentLevel
  );
}

function isCurrentBattleRun(runToken) {
  return Boolean(
    runToken === battleToken
    && activeBattle
    && battleMatches(currentFighter(), currentCountry())
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

function renderActionNotice() {
  if (!actionNotice) return '';
  return `
    <section class="action-notice ${actionNotice.kind}" role="status" aria-live="polite">
      ${escapeHtml(actionNotice.message)}
    </section>
  `;
}

function spriteRowIndex(stateName) {
  return Math.max(0, spriteStates.indexOf(stateName));
}

function spriteDuration(stateName) {
  if (stateName === 'attack') return '760ms';
  if (stateName === 'hurt') return '640ms';
  if (stateName === 'victory') return '820ms';
  return '900ms';
}

function assetUrl(path) {
  return new URL(path, document.baseURI).href;
}

function animatedSpriteMarkup(sprite, stateName = 'idle', fallback = sprite.fallbackEmoji, extraClass = '') {
  const row = spriteRowIndex(stateName);
  const frames = sprite.frameContract.rows[stateName]?.frames || sprite.frameContract.rows.idle.frames;
  const atlas = assetUrl(sprite.atlas);
  const atlasState = spriteLoadStates.get(atlas);
  const loadClass = atlasState ? ` sprite-${atlasState}` : ' sprite-loading';
  const safeAtlas = escapeHtml(atlas);
  const steps = Math.max(1, frames - 1);
  const shift = steps * 192;
  return `
    <span class="animated-sprite state-${stateName} ${extraClass}${loadClass}"
      data-sprite-atlas="${safeAtlas}"
      data-sprite-state="${stateName}"
      style="--sprite-url:url('${safeAtlas}');--sprite-row-y:-${row * 192}px;--sprite-shift-x:-${shift}px;--sprite-steps:${steps};--sprite-duration:${spriteDuration(stateName)};">
      <span class="sprite-atlas-track" aria-hidden="true"></span>
      <span class="sprite-fallback" aria-hidden="true">${escapeHtml(fallback)}</span>
    </span>
  `;
}

function hydrateSpriteFallbacks() {
  document.querySelectorAll('.animated-sprite[data-sprite-atlas]').forEach((node) => {
    const atlas = node.dataset.spriteAtlas;
    const knownState = spriteLoadStates.get(atlas);
    if (knownState) {
      node.classList.remove('sprite-loading');
      node.classList.add(`sprite-${knownState}`);
      return;
    }

    const probe = new Image();
    probe.addEventListener('load', () => {
      spriteLoadStates.set(atlas, 'loaded');
      node.classList.remove('sprite-loading');
      node.classList.add('sprite-loaded');
    }, { once: true });
    probe.addEventListener('error', () => {
      spriteLoadStates.set(atlas, 'failed');
      node.classList.remove('sprite-loading');
      node.classList.add('sprite-failed');
    }, { once: true });
    probe.src = atlas;
  });
}

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

function focusBattleOnMobile() {
  if (!window.matchMedia('(max-width: 700px)').matches) return;

  window.requestAnimationFrame(() => {
    const arena = document.querySelector('.battle-stage');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    arena?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  });
}

function render() {
  const country = currentCountry();
  const fighter = currentFighter();
  const summary = getCampaignSummary(state);
  const bossOnStage = (summary.bossUnlocked && !state.bossDefeated) || lastBossAnimation;
  const enemy = bossOnStage ? bossData : (country?.freed ? null : getEnemyForLevel(country.currentLevel));
  const stats = getBattleStats(fighter);
  const recommendation = getNextRecommendation(state);
  const fighterSprite = getSpriteForEntity(fighter.id);
  const enemySprite = getSpriteForEntity(bossOnStage ? 'boss' : 'zombie');
  const fighterState = heroSpriteState(country);
  const enemyState = enemySpriteState(enemy);
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
  const bossDisabled = isBattleAnimating || !(summary.bossUnlocked && !state.bossDefeated);
  const fightLabel = activeBattle ? '⚔️ Удар' : '⚔️ Битися з зомбі';
  const quickFightLabel = activeBattle ? '⚔️ Удар' : '⚔️ Бій';
  const battlePhaseClass = battlePhase === 'idle' ? '' : `phase-${battlePhase}`;

  app.innerHTML = `
    <section class="hero-card splash-hero" aria-label="ImageGen art bible і головна мапа пригоди">
      <figure class="concept-preview art-bible-shot">
        <picture>
          <source srcset="assets/concept/zombie-liberation-art-bible-v2.webp" type="image/webp" />
          <img src="assets/concept/zombie-liberation-art-bible-v2.png" alt="Згенерований арт-напрям гри: пʼять героїв, зомбі-бос і мапа країн" decoding="async" fetchpriority="high" />
        </picture>
        <figcaption>ImageGen art bible v2 → UI, мапа, герої та Hatch Pet-like sprite contract.</figcaption>
      </figure>
      <div class="title-block splash-copy">
        <p class="eyebrow">Дитяча пригода без важкого тону</p>
        <h1>Рятівники країн <span>проти Зомбі-Боса</span></h1>
        <p class="subtitle">Звільни ${summary.totalCountries} країн, відкривай бійців у Мегабоксах і переможи Зомбі-Боса Буль-Буля!</p>
        <div class="hero-pills" aria-label="Ключові правила гри">
          <span>🌍 5 країн</span>
          <span>🎁 10 рівень = Мегабокс</span>
          <span>🍀 56% шанс бійця</span>
          <span>👑 фінальний бос</span>
        </div>
      </div>
      <aside class="world-map" aria-label="Мапа країн для спасіння">
        <h2>🗺️ Мапа</h2>
        <div class="map-nodes">
          ${state.countries.map(renderMapNode).join('')}
        </div>
      </aside>
    </section>

    <nav class="mobile-quick-actions" aria-label="Швидкі дії">
      <button class="primary" data-action="fight" aria-label="${activeBattle ? 'Удар' : 'Битися з зомбі'}" ${fightDisabled ? 'disabled' : ''}>${quickFightLabel}</button>
      <button data-action="boss" aria-label="Битва з босом" ${bossDisabled ? 'disabled' : ''}>👑 Бос</button>
      <button data-action="reset-save" aria-label="Нова гра">🔄 Нова</button>
    </nav>

    <section class="status-row" aria-label="Статус кампанії">
      <article class="stat-card coins">🪙 <strong>${state.coins}</strong><span>монет</span></article>
      <article class="stat-card">🌍 <strong>${summary.savedCountries}/${summary.totalCountries}</strong><span>країн врятовано</span></article>
      <article class="stat-card">🎁 <strong>${MEGA_BOX_LEVEL}</strong><span>рівень = Мегабокс</span></article>
      <article class="stat-card">🍀 <strong>${state.pityTokens}/${PITY_TOKENS_FOR_UNLOCK}</strong><span>жетони удачі</span></article>
      <article class="stat-card">🏁 <strong>${summary.totalCompletedLevels}/${summary.totalLevels}</strong><span>рівнів пройдено</span></article>
    </section>

    <section class="recommendation ${recommendation.kind}" aria-live="polite">
      <strong>Підказка:</strong> ${escapeHtml(recommendation.message)}
    </section>

    ${renderActionNotice()}

    <section class="game-grid">
      <article class="arena panel">
        <div class="country-banner" style="--country-color:${country.color}">
          <span class="country-icon">${country.icon}</span>
          <div>
            <h2>${escapeHtml(country.name)}</h2>
            <p>${country.freed ? 'Країну вже звільнено!' : `Рівень ${country.currentLevel} з ${LEVELS_PER_COUNTRY}`}</p>
            <p class="chapter-copy">${escapeHtml(country.chapter)}</p>
          </div>
        </div>

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

        <div class="actions">
          <button class="primary" data-action="fight" ${fightDisabled ? 'disabled' : ''}>${fightLabel}</button>
          <button data-action="boss" ${bossDisabled ? 'disabled' : ''}>👑 Битва з босом</button>
          <button data-action="reset-save">🔄 Нова гра</button>
          ${qaMode ? renderQaControls() : ''}
        </div>
      </article>

      <article class="fighters panel">
        <h2>${summary.unlockedFighters}/${summary.totalFighters} бійців</h2>
        <div class="fighter-list">
          ${state.fighters.map(renderFighterCard).join('')}
        </div>
      </article>

      <article class="story panel">
        <h2>Журнал пригод</h2>
        <ol class="log-list" aria-live="polite">
          ${state.log.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}
        </ol>
        <div class="boss-card ${summary.bossUnlocked ? 'unlocked' : ''}">
          <strong>🧟‍♂️ Зомбі-Бос Буль-Буль</strong>
          <span>${state.bossDefeated ? 'Переможений! Гра пройдена!' : summary.bossUnlocked ? 'Бос відкритий — збери команду!' : 'Відкриється після 5 врятованих країн.'}</span>
        </div>
        <p class="save-note">💾 Прогрес зберігається автоматично у браузері.</p>
      </article>
    </section>
  `;

  hydrateSpriteFallbacks();
  syncQaGlobals();
}

function renderQaControls() {
  return `
    <button data-action="dev-level10">QA: перейти до рівня 10</button>
    <button data-action="dev-free-country">QA: звільнити країну</button>
    <button data-action="dev-free-all">QA: звільнити всі країни</button>
    <button data-action="dev-max-fighters">QA: максимальні бійці</button>
  `;
}

function renderMapNode(country) {
  const selected = country.id === state.selectedCountryId ? 'selected' : '';
  const status = country.freed ? 'saved' : country.currentLevel >= MEGA_BOX_LEVEL ? 'box-ready' : 'progress';
  const progress = getCountryProgress(country);
  return `
    <button class="map-node ${selected} ${status}" data-country="${country.id}" title="${escapeHtml(country.name)} — ${escapeHtml(progress.nextRewardLabel)}">
      <span>${country.icon}</span>
      <small>${progress.percent}%</small>
    </button>
  `;
}

function renderFighterCard(fighter) {
  const selected = fighter.id === state.selectedFighterId ? 'selected' : '';
  const stats = getBattleStats(fighter);
  const cost = getUpgradeCost(fighter.level);
  const sprite = getSpriteForEntity(fighter.id);
  const upgradeBlockedByBattle = Boolean(activeBattle) || isBattleAnimating;
  const upgradeDisabled = !fighter.unlocked || fighter.level >= MAX_FIGHTER_LEVEL || upgradeBlockedByBattle;
  const upgradeTitle = upgradeBlockedByBattle ? 'Заверши поточний бій перед прокачкою' : '';
  return `
    <div class="fighter-card ${selected} ${fighter.unlocked ? '' : 'locked'}" style="--accent:${fighter.color}">
      <button class="fighter-select" data-fighter="${fighter.id}" ${fighter.unlocked ? '' : 'disabled'}>
        <span class="avatar" data-sprite-atlas="${escapeHtml(sprite.atlas)}">
          ${animatedSpriteMarkup(sprite, 'idle', sprite.fallbackEmoji, 'avatar-sprite')}
          ${fighter.unlocked ? '' : '<span class="lock-badge" aria-hidden="true">🔒</span>'}
        </span>
        <span>
          <strong>${escapeHtml(fighter.name)}</strong>
          <em>${escapeHtml(fighter.role)}</em>
        </span>
      </button>
      <p>Рівень ${fighter.level}/${MAX_FIGHTER_LEVEL} · HP ${stats.hp} · Урон ${stats.damage}</p>
      <button class="upgrade" data-upgrade="${fighter.id}" title="${escapeHtml(upgradeTitle)}" ${upgradeDisabled ? 'disabled' : ''}>
        ⬆️ Прокачати ${fighter.level < MAX_FIGHTER_LEVEL ? `за ${cost} монет` : 'MAX'}
      </button>
    </div>
  `;
}

async function handleFight() {
  if (isBattleAnimating) return;
  clearActionNotice();

  const country = currentCountry();
  if (country.freed) return;

  if (!activeBattle || !battleMatches(currentFighter(), country)) {
    const created = createBattleSession(state, state.selectedFighterId, state.selectedCountryId);
    if (!created.created) {
      clearActiveBattle();
      const message = 'Цей бій зараз недоступний. Обери відкритого бійця і країну з активним рівнем.';
      setActionNotice('warning', message);
      addLog(state, message);
      saveGame(storage, state);
      render();
      return;
    }
    activeBattle = created.session;
  }

  battleToken += 1;
  const runToken = battleToken;
  isBattleAnimating = true;
  battlePhase = 'hero-attack';
  const heroAttack = applyHeroAttack(activeBattle);
  activeBattle = heroAttack.session;
  lastBattleAnimation = 'hero';
  lastDamagePopup = { target: 'enemy', amount: heroAttack.damage };
  render();
  focusBattleOnMobile();
  await wait(HERO_ATTACK_MS);
  if (!isCurrentBattleRun(runToken)) return;

  if (getBattleOutcome(activeBattle) === 'victory') {
    battlePhase = 'victory';
    lastDamagePopup = null;
    render();
    await wait(OUTCOME_PAUSE_MS);
    if (!isCurrentBattleRun(runToken)) return;

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
  focusBattleOnMobile();
  await wait(ENEMY_ATTACK_MS);
  if (!isCurrentBattleRun(runToken)) return;

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

async function handleBoss() {
  if (isBattleAnimating) return;
  clearActiveBattle();
  const runToken = battleToken;
  isBattleAnimating = true;

  const result = fightBoss(state, state.selectedFighterId);
  if (result.victory) {
    lastBattleAnimation = 'hero';
    lastBossAnimation = true;
    addLog(state, '🏆 Команда перемогла Зомбі-Боса Буль-Буля!');
  } else {
    lastBattleAnimation = 'enemy';
    addLog(state, 'Бос поки занадто сильний — прокачай бійців до вищих рівнів.');
  }
  saveGame(storage, state);
  render();
  await wait(HERO_ATTACK_MS);
  if (runToken !== battleToken) return;

  lastBattleAnimation = null;
  lastBossAnimation = false;
  isBattleAnimating = false;
  render();
}

function handleUpgrade(fighterId) {
  const result = upgradeFighter(state, fighterId);
  if (!result.upgraded) {
    if (result.reason === 'not_enough_coins') {
      const message = `Потрібно ${result.cost} монет для прокачки. Зараз у тебе ${state.coins}.`;
      setActionNotice('warning', message);
      addLog(state, message);
    } else {
      const message = 'Цього бійця зараз не можна прокачати.';
      setActionNotice('warning', message);
      addLog(state, message);
    }
    return;
  }

  clearActiveBattle();
  const message = `${result.fighter.name} тепер рівня ${result.fighter.level}!`;
  setActionNotice('success', message);
  addLog(state, message);
}

function devLevel10() {
  clearActiveBattle();
  const country = currentCountry();
  const fighter = currentFighter();
  if (!country.freed) {
    country.currentLevel = MEGA_BOX_LEVEL;
    if (fighter.unlocked) fighter.level = Math.max(fighter.level, MAX_FIGHTER_LEVEL);
    addLog(state, `QA: ${country.name} поставлено на рівень 10, а ${fighter.name} підсилено для перевірки Мегабокса.`);
  }
}

function devFreeCountry() {
  clearActiveBattle();
  const country = currentCountry();
  country.currentLevel = LEVELS_PER_COUNTRY;
  country.freed = true;
  country.megaBoxClaimed = true;
  addLog(state, `QA: ${country.name} позначено як звільнену.`);
}

function devFreeAllCountries() {
  clearActiveBattle();
  for (const country of state.countries) {
    country.currentLevel = LEVELS_PER_COUNTRY;
    country.freed = true;
    country.megaBoxClaimed = true;
  }
  addLog(state, 'QA: усі 5 країн позначено врятованими.');
}

function devMaxFighters() {
  clearActiveBattle();
  for (const fighter of state.fighters) {
    fighter.unlocked = true;
    fighter.level = MAX_FIGHTER_LEVEL;
  }
  addLog(state, 'QA: усі бійці відкриті та прокачані до 10 рівня.');
}

function handleReset() {
  Object.assign(state, resetGame(storage));
  clearActiveBattle();
  lastBossAnimation = false;
  addLog(state, 'Збереження очищено. Пригода починається спочатку!');
}

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
  if (target.dataset.action === 'boss') {
    void handleBoss();
    return;
  }
  if (target.dataset.action === 'reset-save') handleReset();
  if (target.dataset.action === 'dev-level10') devLevel10();
  if (target.dataset.action === 'dev-free-country') devFreeCountry();
  if (target.dataset.action === 'dev-free-all') devFreeAllCountries();
  if (target.dataset.action === 'dev-max-fighters') devMaxFighters();

  saveGame(storage, state);
  render();
});

function syncQaGlobals() {
  if (!qaMode) return;

  window.__zombieGameState = state;
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
}

render();
