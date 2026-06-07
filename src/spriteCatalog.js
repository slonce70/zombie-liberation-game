export const spriteStates = ['idle', 'attack', 'hurt', 'victory'];

export const spriteFrameContract = {
  cellSize: 192,
  maxColumns: 6,
  rows: {
    idle: { frames: 4, description: 'calm breathing bounce' },
    attack: { frames: 6, description: 'safe action pose without detached impact effects' },
    hurt: { frames: 4, description: 'surprised safe cartoon reaction' },
    victory: { frames: 4, description: 'cheerful celebration pose' },
  },
};

export const spriteArtBible = {
  conceptPath: 'assets/concept/zombie-liberation-art-bible-v2.png',
  analysisPath: 'docs/art/imagegen-concept-analysis.md',
  pipelinePath: 'docs/art/hatch-pet-adapted-sprite-pipeline.md',
  promptsPath: 'docs/art/entity-imagegen-prompts.md',
};

export const spriteStyleRules = {
  style: 'kid-friendly colorful 2D game sprites, compact hatch-pet-like silhouettes, readable at small size',
  keep: 'same identity, face, palette, outfit, proportions, and prop cue across idle/attack/hurt/victory',
  avoid: 'blood, gore, horror, wounds, readable logos, text, copyrighted characters, exact flags, official emblems, realistic weapons, detached effects, shadows, smoke clouds, speed lines, confetti, guide marks',
};

const catalog = {
  artem: makeFighter('artem', 'Артем Блискавка', '⚡', 'lightning hero with blue/yellow outfit'),
  sofia: makeFighter('sofia', 'Софія Щит', '🛡️', 'shield defender with rounded toy-like crystal shield'),
  maks: makeFighter('maks', 'Макс Ракета', '🚀', 'rocket-energy attacker with toy-like rocket backpack cue'),
  lina: makeFighter('lina', 'Ліна Іскра', '✨', 'spark tactician with attached star costume cue'),
  danylo: makeFighter('danylo', 'Данило Лев', '🦁', 'lion finisher with mane hood or plush lion glove'),
  zombie: makeEnemy('zombie', 'Веселий зомбі', '🧟', 'silly non-scary zombie minion'),
  boss: makeBoss('boss', 'Зомбі-Бос Буль-Буль', '🧟‍♂️', 'large goofy round zombie boss'),
};

function makeFighter(id, name, fallbackEmoji, promptCue) {
  return makeEntity({
    id,
    name,
    group: 'fighters',
    fallbackEmoji,
    promptCue,
  });
}

function makeEnemy(id, name, fallbackEmoji, promptCue) {
  return makeEntity({
    id,
    name,
    group: 'zombies',
    fallbackEmoji,
    promptCue,
  });
}

function makeBoss(id, name, fallbackEmoji, promptCue) {
  return makeEntity({
    id,
    name,
    group: 'boss',
    fallbackEmoji,
    promptCue,
  });
}

function makeEntity({ id, name, group, fallbackEmoji, promptCue }) {
  return {
    id,
    name,
    group,
    fallbackEmoji,
    promptCue,
    artBible: spriteArtBible.conceptPath,
    atlas: `assets/sprites/${group}/${id}/spritesheet.webp`,
    manifest: `assets/sprites/${group}/${id}/manifest.json`,
    frameContract: spriteFrameContract,
    states: Object.fromEntries(spriteStates.map((state, row) => [state, {
      row,
      frames: spriteFrameContract.rows[state].frames,
      atlas: `assets/sprites/${group}/${id}/spritesheet.webp`,
    }])),
  };
}

export function getSpriteForEntity(id) {
  return catalog[id] || catalog.zombie;
}

export function getSpriteCatalog() {
  return catalog;
}
