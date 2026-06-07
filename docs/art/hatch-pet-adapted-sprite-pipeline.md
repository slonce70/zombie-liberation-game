# Hatch Pet-like Sprite Pipeline for Zombie Liberation

This game uses a simplified Hatch Pet-style contract adapted for child-friendly fighters and NPCs.

## Goal

Generate consistent animated sprites for:

- 5 fighters: Артем Блискавка, Софія Щит, Макс Ракета, Ліна Іскра, Данило Лев
- 1 regular zombie NPC: Веселий зомбі
- 1 boss NPC: Зомбі-Бос Буль-Буль

The generated ImageGen concept `assets/concept/zombie-liberation-art-bible-v2.png` is the style reference.

## Why not use one-off images only?

One-off images drift between states. Hatch Pet works because it locks:

1. identity,
2. silhouette,
3. palette,
4. frame layout,
5. animation state contract,
6. validation/contact-sheet QA.

This project follows the same idea, but with a smaller game-specific state set.

## Game sprite states

Each entity has 4 states:

| State | Frames | Purpose |
| --- | ---: | --- |
| `idle` | 4 | calm loop / breathing bounce |
| `attack` | 6 | safe action pose, no detached impact effects |
| `hurt` | 4 | surprised cartoon reaction, no wounds |
| `victory` | 4 | happy success pose |

## Atlas contract

Preferred final format per entity:

- `assets/sprites/<group>/<id>/spritesheet.webp`
- transparent-capable WebP or PNG
- 4 rows: `idle`, `attack`, `hurt`, `victory`
- 6 columns maximum
- 192x192 logical cell size
- unused cells transparent
- no shadows, no detached effects, no guide marks

The game can also consume per-state WebP paths for early MVP replacement:

- `assets/sprites/fighters/<id>-idle.webp`
- `assets/sprites/fighters/<id>-attack.webp`
- `assets/sprites/fighters/<id>-hurt.webp`
- `assets/sprites/fighters/<id>-victory.webp`

## ImageGen row prompt rules

Every generated row should use:

- the V2 concept image as style reference,
- the entity base image as identity reference,
- a row layout guide if available,
- flat chroma-key background if true transparency is not available,
- no text/logos/watermarks,
- no blood/gore/horror,
- no detached effects,
- compact full-body readable silhouette,
- same face, palette, outfit, proportions, and prop cue across states.

## QA acceptance

Accept a sprite only if:

- all frames have the same identity,
- the body is not cropped,
- the silhouette is readable at small size,
- animation state is recognizable,
- no frame contains text/logo/guide marks,
- no scary/gory details appear,
- no detached effects or heavy shadows appear,
- idle loop is not visually inert,
- attack has motion pose but no impact burst,
- hurt is safe and funny, not painful,
- victory is cheerful without confetti/floating symbols.

## Recommended production order

1. Generate/approve one base image per entity.
2. Generate `idle` and `attack` first to lock identity and action language.
3. Generate `hurt` and `victory` using the same base.
4. Compose a contact sheet.
5. Run visual QA.
6. Export final atlas or per-state assets.
7. Replace emoji fallbacks in game only after QA passes.
