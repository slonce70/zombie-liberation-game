# Zombie Liberation V1 QA Checklist

## Automated
- `node --check src/main.js`
- `node --check src/gameLogic.js`
- `npm test`
- `npm run smoke`
- `npm run verify`

## Manual normal path
1. Open `http://127.0.0.1:4173`.
2. Confirm the top-right map shows 5 countries.
3. Fight level 1 and confirm coins become 50.
4. Upgrade Артем after enough coins.
5. Reach level 10 in `?qa=1` mode and confirm Mega Box behavior.
6. Free all 5 countries in `?qa=1` mode and confirm boss unlocks.
7. Fight boss with upgraded fighters and confirm victory log.

## Manual safety path
- Confirm no blood/gore/scary copy is visible.
- Confirm QA buttons are hidden without `?qa=1`.
- Confirm reduced-motion mode does not rely on animation to understand the game.
- Confirm reset starts a clean game.
