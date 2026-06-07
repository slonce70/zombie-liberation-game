#!/usr/bin/env python3
import argparse
from collections import deque
from pathlib import Path
from PIL import Image

STATES = [('idle', 4), ('attack', 6), ('hurt', 4), ('victory', 4)]
CELL = 192

def transparent_from_key(image):
    im = image.convert('RGBA')
    pixels = im.load()
    samples = [pixels[0,0], pixels[im.width-1,0], pixels[0,im.height-1], pixels[im.width-1,im.height-1]]
    key = tuple(sum(s[i] for s in samples)//len(samples) for i in range(3))
    out = Image.new('RGBA', im.size)
    op = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a = pixels[x,y]
            dist = abs(r-key[0]) + abs(g-key[1]) + abs(b-key[2])
            if dist < 90 or (g > 180 and r < 90 and b < 90):
                op[x,y] = (0,0,0,0)
            else:
                op[x,y] = (r,g,b,255)
    return out

def keep_largest_component(im):
    px = im.load()
    w,h = im.size
    seen = bytearray(w*h)
    best = []
    for y in range(h):
        for x in range(w):
            idx=y*w+x
            if seen[idx] or px[x,y][3] == 0:
                continue
            comp=[]
            q=deque([(x,y)])
            seen[idx]=1
            while q:
                cx,cy=q.popleft(); comp.append((cx,cy))
                for nx,ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        nidx=ny*w+nx
                        if not seen[nidx] and px[nx,ny][3] > 0:
                            seen[nidx]=1; q.append((nx,ny))
            if len(comp) > len(best):
                best = comp
    mask=set(best)
    out=Image.new('RGBA', im.size, (0,0,0,0))
    op=out.load()
    for x,y in best:
        op[x,y]=px[x,y]
    return out

def contain(im):
    bbox=im.getbbox()
    if not bbox:
        return Image.new('RGBA',(CELL,CELL),(0,0,0,0))
    cropped=im.crop(bbox)
    scale=min((CELL-18)/cropped.width, (CELL-18)/cropped.height)
    nw=max(1, round(cropped.width*scale)); nh=max(1, round(cropped.height*scale))
    resized=cropped.resize((nw,nh), Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(CELL,CELL),(0,0,0,0))
    out.alpha_composite(resized, ((CELL-nw)//2, CELL-nh-8))
    return out


def row_components(row_img):
    px=row_img.load(); w,h=row_img.size
    seen=bytearray(w*h)
    comps=[]
    for y in range(h):
        for x in range(w):
            idx=y*w+x
            if seen[idx] or px[x,y][3] == 0:
                continue
            comp=[]; q=deque([(x,y)]); seen[idx]=1
            while q:
                cx,cy=q.popleft(); comp.append((cx,cy))
                for nx,ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        nidx=ny*w+nx
                        if not seen[nidx] and px[nx,ny][3] > 0:
                            seen[nidx]=1; q.append((nx,ny))
            if len(comp) > 60:
                xs=[pt[0] for pt in comp]; ys=[pt[1] for pt in comp]
                comps.append({'pixels': comp, 'bbox': (min(xs), min(ys), max(xs)+1, max(ys)+1), 'area': len(comp)})
    comps.sort(key=lambda c: c['bbox'][0])
    return comps

def component_image(row_img, comp):
    bbox=comp['bbox']
    return row_img.crop(bbox)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--entity-dir', required=True)
    ap.add_argument('--slot-mode', action='store_true', help='Force equal slot slicing instead of component detection')
    args=ap.parse_args()
    sheet=Image.open(args.sheet).convert('RGBA')
    entity=Path(args.entity_dir)
    source=entity/'source'; source.mkdir(parents=True, exist_ok=True)
    transparent=transparent_from_key(sheet)
    row_h=sheet.height/len(STATES)
    for row,(state,frames) in enumerate(STATES):
        strip=Image.new('RGBA',(frames*CELL,CELL),(0,0,0,0))
        row_img=transparent.crop((0, round(row*row_h), sheet.width, round((row+1)*row_h)))
        comps=row_components(row_img)
        # If imagegen accidentally splits one pose into multiple nearby components, keep largest components.
        comps=sorted(comps, key=lambda c: c['area'], reverse=True)[:frames]
        comps=sorted(comps, key=lambda c: c['bbox'][0])
        if len(comps) < frames or args.slot_mode:
            frame_w=sheet.width/frames
            frames_raw=[row_img.crop((round(frame*frame_w),0,round((frame+1)*frame_w),row_img.height)) for frame in range(frames)]
        else:
            frames_raw=[component_image(row_img, comp) for comp in comps]
        for frame, raw in enumerate(frames_raw[:frames]):
            clean=contain(keep_largest_component(raw))
            strip.alpha_composite(clean,(frame*CELL,0))
        strip.save(source/f'{state}-strip.png')
    print(f'Wrote strips to {source}')

if __name__ == '__main__':
    main()
