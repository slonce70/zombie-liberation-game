import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const files = ['index.html', 'src/main.js', 'src/styles.css', 'src/gameLogic.js', 'src/gameData.js'];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  assert.ok(content.length > 100, `${file} should not be empty`);
}

const html = await readFile('index.html', 'utf8');
assert.match(html, /src\/main\.js/);
assert.doesNotMatch(html, /(src|href)="\//, 'GitHub Pages requires relative asset paths');

const main = await readFile('src/main.js', 'utf8');
assert.match(main, /world-map/);
assert.match(main, /splash-hero/);
assert.match(main, /art-bible-shot/);
assert.match(main, /hero-pills/);
assert.match(main, /loadGame/);
assert.match(main, /saveGame/);
assert.match(main, /getCampaignSummary/);
assert.match(main, /getSpriteForEntity/);
assert.match(main, /zombie-liberation-art-bible-v2/);
assert.match(main, /zombie-liberation-art-bible-v2\.webp/);
assert.match(main, /qaMode/);
assert.match(main, /dev-level10/);
assert.match(main, /dev-free-all/);
assert.match(main, /dev-max-fighters/);
assert.match(main, /window\.__zombieGameActions/);
assert.match(main, /animatedSpriteMarkup/);
assert.match(main, /data-sprite-atlas/);
assert.match(main, /spriteStates/);
assert.match(main, /createBattleSession/);
assert.match(main, /applyHeroAttack/);
assert.match(main, /applyEnemyCounterAttack/);
assert.match(main, /resolveBattleVictory/);
assert.match(main, /activeBattle/);
assert.match(main, /isBattleAnimating/);
assert.match(main, /renderHpPanel/);
assert.match(main, /renderDamagePopup/);
assert.match(main, /__zombieGameBattle/);
assert.match(main, /mobile-quick-actions/);
assert.match(main, /focusBattleOnMobile/);
assert.doesNotMatch(main, /url\('\/\$\{atlas\}'\)/, 'sprite atlas URLs must remain relative for GitHub Pages project sites');

const css = await readFile('src/styles.css', 'utf8');
assert.match(css, /\.world-map/);
assert.match(css, /\.splash-hero/);
assert.match(css, /\.art-bible-shot/);
assert.match(css, /\.hero-pills/);
assert.match(css, /@keyframes petIdle/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /\.recommendation/);
assert.match(css, /petAttack/);
assert.match(css, /\.animated-sprite/);
assert.match(css, /@keyframes spriteAtlas/);
assert.match(css, /\.sprite-failed/);
assert.match(css, /\.hp-panel/);
assert.match(css, /\.hp-meter/);
assert.match(css, /\.hp-fill/);
assert.match(css, /\.damage-popup/);
assert.match(css, /@keyframes damageFloat/);
assert.match(css, /\.battle-stage\.phase-hero-attack/);
assert.match(css, /\.battle-stage\.phase-enemy-attack/);
assert.match(css, /\.mobile-quick-actions/);
assert.match(css, /100dvh/);

console.log('Smoke check passed: app shell, map, QA hooks, and generated atlas sprite animation are present.');
