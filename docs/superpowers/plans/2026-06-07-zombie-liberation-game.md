# Zombie Liberation Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete playable static browser game about freeing 5 countries from zombies and defeating a zombie boss.

**Architecture:** Static `index.html` loads `src/main.js`. Pure game rules live in `src/gameLogic.js` and content in `src/gameData.js`. CSS handles kid-friendly art direction and hatch-pet-like animated character tokens.

**Tech Stack:** Vanilla HTML/CSS/JavaScript modules, Node built-in test runner, Python http.server for browser QA.

---

### Task 1: Pure game rules and tests
**Files:**
- Create: `src/gameData.js`
- Create: `src/gameLogic.js`
- Create: `test/gameLogic.test.js`

- [ ] Write tests for level 1 reward = 50 coins, Mega Box 56% unlock boundary, upgrade max level 10, country freed after 25 wins, boss unlocked after all countries freed.
- [ ] Run `node --test test/gameLogic.test.js` and verify RED before implementation.
- [ ] Implement data and pure functions to make tests pass.
- [ ] Re-run tests and verify GREEN.

### Task 2: UI shell and rendering
**Files:**
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/styles.css`

- [ ] Render title, arena, top-right map, fighter cards, level controls, coins, log, boss panel.
- [ ] Wire attack button to battle simulation using pure game rules.
- [ ] Wire upgrade buttons and country map selection.
- [ ] Add kid-friendly responsive CSS.

### Task 3: Project metadata and assets
**Files:**
- Create: `package.json`
- Create/copy: `assets/concept/zombie-liberation-concept.png`
- Create: `assets/README.md`

- [ ] Copy selected ImageGen concept into project assets.
- [ ] Add npm scripts for tests, smoke checks, and local serving.
- [ ] Document generated visual direction and hatch-pet-like sprite approach.

### Task 4: Verification and browser QA
**Files:**
- Modify as needed based on test/QA findings.

- [ ] Run `npm test`.
- [ ] Run static smoke check.
- [ ] Start local server and verify in Browser plugin.
- [ ] Run code review and adversarial QA pass; fix issues until clean.
