# Zombie Liberation Game Design

## Goal
Build a kid-friendly browser game where the player frees 5 countries from zombies, unlocks and upgrades 5 fighters, and defeats a final zombie boss.

## Audience and tone
The creator is 10 years old, so the game must be colorful, readable, playful, and non-gory. Zombies are silly monsters, not horror enemies. All characters are original.

## Core content
- Countries to save: Україна, Польща, Японія, Бразилія, Єгипет.
- Fighters:
  1. Артем Блискавка — fast balanced starter.
  2. Софія Щит — strong HP defender.
  3. Макс Ракета — high damage striker.
  4. Ліна Іскра — clever support attacker.
  5. Данило Лев — powerful late-game hero.
- Final boss: Зомбі-Бос Буль-Буль.

## Gameplay loop
A country has 25 levels. The player selects the active country from the top-corner map, fights a zombie for the current level, earns coins after victory, and progresses to the next level. Level 10 in each country awards one Mega Box. A Mega Box has a 56% chance to unlock one still-locked fighter; unlucky boxes give pity tokens so the game cannot become unwinnable. Completing level 25 marks the country as freed. When all 5 countries are freed, the final boss battle unlocks.

## Progression rules
- Level 1 victory gives 50 coins. Later levels reward more coins with a small linear increase.
- Fighters can be upgraded to level 10.
- Upgrades cost coins; each fighter level increases HP and damage.
- At least one starter fighter is unlocked at the beginning.

## Interface
- Main area: battle arena with heroes versus zombie/enemy.
- Top-right: compact map showing 5 countries and their saved/in-progress/locked-ish status.
- Side panels: fighter cards, upgrade buttons, current level, coins, log, Mega Box/boss status.

## Visual direction
Use the generated concept image as a style reference: colorful 2D mobile-game illustration, 5 distinct hero silhouettes, cute/silly zombies, visible level path, and a compact map. For production assets, use hatch-pet-like sprite thinking: simple readable character tokens with idle/bounce/attack CSS animation, consistent silhouettes, no gore, no copyrighted designs.

## Technical approach
Use a lightweight static web app: HTML, CSS, and JavaScript modules. Keep game math in focused state-transition functions so it can be tested with Node's built-in test runner. No external dependencies required.

## Testing and QA
Automated tests cover rewards, Mega Box probability boundaries, fighter upgrades, country completion, and final boss unlock. Browser QA confirms the game renders, map is top-right, fighting works, upgrades work, and level 10 Mega Box behavior is reachable via test hooks/dev controls.
