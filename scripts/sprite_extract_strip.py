#!/usr/bin/env python3
"""Extract one generated chroma-key row strip into a normalized 192px-cell transparent strip."""
from __future__ import annotations
import argparse
import sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sprite_split_sheet import transparent_from_key, row_components, component_image, keep_largest_component, contain

CELL = 192

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--strip', required=True)
    parser.add_argument('--frames', required=True, type=int)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    source = Image.open(args.strip).convert('RGBA')
    cleaned = transparent_from_key(source)
    comps = row_components(cleaned)
    if len(comps) >= args.frames:
        # Prefer largest useful components, then restore visual order.
        comps = sorted(comps, key=lambda c: c["area"], reverse=True)[:args.frames]
        comps = sorted(comps, key=lambda c: c["bbox"][0])
        frames_raw = [component_image(cleaned, c) for c in comps]
    else:
        # Slot fallback for very connected rows.
        width, height = cleaned.size
        slot = width / args.frames
        frames_raw = [cleaned.crop((round(i*slot), 0, round((i+1)*slot), height)) for i in range(args.frames)]

    strip = Image.new('RGBA', (CELL * args.frames, CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames_raw[:args.frames]):
        frame = keep_largest_component(frame)
        strip.alpha_composite(contain(frame), (i * CELL, 0))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out)
    print(f'Wrote {out} from {len(comps)} detected components')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
