#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SPRITE_ROOT = ROOT / 'assets' / 'sprites'
CELL = 192
MAX_COLUMNS = 6
STATES = ['idle', 'attack', 'hurt', 'victory']
FRAMES = {'idle': 4, 'attack': 6, 'hurt': 4, 'victory': 4}

ENTITIES = [
    {'id': 'artem', 'name': 'Артем Блискавка', 'group': 'fighters', 'emoji': '⚡'},
    {'id': 'sofia', 'name': 'Софія Щит', 'group': 'fighters', 'emoji': '🛡️'},
    {'id': 'maks', 'name': 'Макс Ракета', 'group': 'fighters', 'emoji': '🚀'},
    {'id': 'lina', 'name': 'Ліна Іскра', 'group': 'fighters', 'emoji': '✨'},
    {'id': 'danylo', 'name': 'Данило Лев', 'group': 'fighters', 'emoji': '🦁'},
    {'id': 'zombie', 'name': 'Веселий зомбі', 'group': 'zombies', 'emoji': '🧟'},
    {'id': 'boss', 'name': 'Зомбі-Бос Буль-Буль', 'group': 'boss', 'emoji': '🧟‍♂️'},
]

def entity_dir(entity):
    return SPRITE_ROOT / entity['group'] / entity['id']

def alpha_image(path):
    image = Image.open(path).convert('RGBA')
    return image

def contain(image, box):
    x, y, w, h = box
    scale = min(w / image.width, h / image.height)
    nw = max(1, round(image.width * scale))
    nh = max(1, round(image.height * scale))
    resized = image.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(resized, ((w - nw) // 2, (h - nh) // 2))
    return out

def compose_entity(entity):
    base = entity_dir(entity)
    source = base / 'source'
    qa = base / 'qa'
    previews = qa / 'previews'
    source.mkdir(parents=True, exist_ok=True)
    qa.mkdir(parents=True, exist_ok=True)
    previews.mkdir(parents=True, exist_ok=True)

    atlas = Image.new('RGBA', (CELL * MAX_COLUMNS, CELL * len(STATES)), (0, 0, 0, 0))
    contact = Image.new('RGBA', atlas.size, (242, 247, 255, 255))
    draw = ImageDraw.Draw(contact)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    except Exception:
        font = None

    manifest_states = {}
    for row, state in enumerate(STATES):
        frames = FRAMES[state]
        strip_path = source / f'{state}-strip.png'
        if not strip_path.exists():
            raise FileNotFoundError(strip_path)
        strip = alpha_image(strip_path)
        frame_w = strip.width / frames
        if frame_w <= 0:
            raise ValueError(f'Bad strip width for {strip_path}')
        for frame in range(frames):
            crop = strip.crop((round(frame * frame_w), 0, round((frame + 1) * frame_w), strip.height))
            cell_img = contain(crop, (0, 0, CELL, CELL))
            atlas.alpha_composite(cell_img, (frame * CELL, row * CELL))
            contact.alpha_composite(cell_img, (frame * CELL, row * CELL))
            draw.rectangle((frame * CELL, row * CELL, (frame + 1) * CELL - 1, (row + 1) * CELL - 1), outline=(108, 139, 205, 255), width=2)
        draw.rectangle((0, row * CELL, 170, row * CELL + 30), fill=(23, 54, 111, 220))
        draw.text((10, row * CELL + 5), f'{state} ({frames})', fill=(255, 255, 255, 255), font=font)
        preview_frames = []
        for frame in range(frames):
            crop = strip.crop((round(frame * frame_w), 0, round((frame + 1) * frame_w), strip.height))
            preview_frames.append(contain(crop, (0, 0, CELL, CELL)))
        preview_path = previews / f'{state}.gif'
        preview_frames[0].save(
            preview_path,
            save_all=True,
            append_images=preview_frames[1:],
            duration=140 if state == 'attack' else 180,
            loop=0,
            disposal=2,
            transparency=0,
        )
        manifest_states[state] = {'row': row, 'frames': frames, 'source': f'source/{state}-strip.png'}

    atlas.save(base / 'spritesheet.png')
    atlas.save(base / 'spritesheet.webp', 'WEBP', quality=92)
    contact.save(qa / 'contact-sheet.png')
    manifest = {
        'contract': 'zombie-liberation-hatch-pet-v1',
        'id': entity['id'],
        'name': entity['name'],
        'group': entity['group'],
        'fallbackEmoji': entity['emoji'],
        'artBible': 'assets/concept/zombie-liberation-art-bible-v2.png',
        'base': 'base.png',
        'spritesheet': 'spritesheet.webp',
        'pngSpritesheet': 'spritesheet.png',
        'cellSize': CELL,
        'columns': MAX_COLUMNS,
        'rows': len(STATES),
        'states': manifest_states,
        'qa': {
            'contactSheet': 'qa/contact-sheet.png',
            'previews': {state: f'qa/previews/{state}.gif' for state in STATES},
            'visualQa': 'pending-human-or-agent-review',
        },
    }
    (base / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return str(base / 'spritesheet.webp')

def validate_entity(entity):
    base = entity_dir(entity)
    required = ['base.png', 'spritesheet.webp', 'spritesheet.png', 'manifest.json', 'qa/contact-sheet.png']
    required.extend([f'source/{state}-strip.png' for state in STATES])
    required.extend([f'qa/previews/{state}.gif' for state in STATES])
    missing = [rel for rel in required if not (base / rel).exists()]
    if missing:
        raise FileNotFoundError(f'{entity["id"]}: missing {missing}')
    manifest = json.loads((base / 'manifest.json').read_text())
    for state in STATES:
        if manifest['states'][state]['frames'] != FRAMES[state]:
            raise ValueError(f'{entity["id"]}: {state} frame mismatch')
    atlas = Image.open(base / 'spritesheet.webp')
    expected = (CELL * MAX_COLUMNS, CELL * len(STATES))
    if atlas.size != expected:
        raise ValueError(f'{entity["id"]}: atlas size {atlas.size}, expected {expected}')

def compose():
    outputs = [compose_entity(entity) for entity in ENTITIES]
    print(json.dumps({'ok': True, 'composed': len(outputs), 'outputs': outputs}, ensure_ascii=False, indent=2))

def validate():
    for entity in ENTITIES:
        validate_entity(entity)
    print(f'Sprite asset validation passed for {len(ENTITIES)} entities.')

def main():
    command = sys.argv[1] if len(sys.argv) > 1 else 'validate'
    if command == 'compose':
        compose()
    elif command == 'validate':
        validate()
    else:
        raise SystemExit(f'Unknown command: {command}')

if __name__ == '__main__':
    main()
