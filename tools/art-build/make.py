# -*- coding: utf-8 -*-
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from png import read_png
import build as BD
import recipes as R

SRC = BD.SRC
OUT = BD.OUT
VEH = SRC + '/isometricvehicles/PNG/Civilian/%s/Sedan 1/car%s_%03d.png'

def ground_img(spec):
    pack, n = spec
    p = {'C': BD.SRC_C, 'L': BD.SRC_L}[pack] % n
    return BD.pad_skirt(BD.load(p), 101)

def grounds(g):
    if isinstance(g, tuple) and len(g) == 2 and isinstance(g[0], str):
        return [ground_img(g)]
    return [ground_img(x) for x in g]

sprites = {}

def emit(key, w, h, rgba, anchor_y, scale=1.0):
    name = key + '.png'
    BD.save(name, w, h, rgba)
    e = {'file': name, 'anchorX': 0.5, 'anchorY': round(anchor_y, 4)}
    if scale != 1.0: e['scale'] = scale
    sprites[key] = e

# 건물 종류별 색조 — Kenney 팩에 회색/남색 벽 모듈이 없어서 눌러 만든다
TINT = {'factory': 'steel', 'power': 'grey', 'police': 'navy', 'hospital': 'white'}
# 티어별 심는 나무 수
TREES = {
    'green':   [7, 6, 5, 4],
    'park':    [5, 4, 3, 2, 2, 1],
    'housing': [4, 3, 1, 0],
    'school':  [3, 2, 2, 1],
    'fishery': [2, 2, 1, 1, 0, 0],
    'mine':    [1, 1, 0, 0, 0, 0],
}

_tree = None
def tree_img():
    global _tree
    if _tree is None:
        _tree = BD.scale_nn(BD.load(BD.SRC_D % '010'), 1.7)
    return _tree

# 결정적 난수 — 빌드마다 같은 그림이 나와야 한다
def rnd(seed):
    x = (seed * 1103515245 + 12345) & 0x7fffffff
    return x

def plant(key_seed, count, used):
    """빈 칸 위주로 나무를 심는다. 같은 키는 항상 같은 배치."""
    out = {}
    if count <= 0: return out
    free = [c for c in ((0, 0), (1, 0), (0, 1), (1, 1)) if c not in used]
    if not free: return out
    cells = free
    s = key_seed
    for k in range(count):
        s = rnd(s)
        cell = cells[s % len(cells)]
        s = rnd(s)
        dx = (s % 70) - 35
        s = rnd(s)
        dy = ((s % 34) - 17)
        # 다이아몬드 밖으로 나가지 않게
        if abs(dx) / 2 + abs(dy) > 30: dx = int(dx * 0.6); dy = int(dy * 0.6)
        out.setdefault(cell, []).append((dx, dy, tree_img()))
    return out

def build_plan(key, p, bid=None, tier=1):
    mode = TINT.get(bid)
    slots = [(i, j, [BD.recolor(BD.B(m), mode) for m in mods]) for i, j, mods in p['slots']]
    used = {(i, j) for i, j, _ in slots}
    n = TREES.get(bid, [])
    count = n[tier - 1] if tier - 1 < len(n) else 0
    decos = plant(sum(ord(c) for c in key) * 7919 + tier, count, used)
    w, h, rgba, ay = BD.compose(grounds(p['ground']), slots, decos)
    emit(key, w, h, rgba, ay)

# ---------- 건물 ----------
for bid, tiers in R.BUSINESS.items():
    for t, p in enumerate(tiers, start=1):
        build_plan('buildings/%s_%d' % (bid, t), p, bid, t)
for fid, tiers in R.FACILITY.items():
    for t, p in enumerate(tiers, start=1):
        build_plan('buildings/%s_%d' % (fid, t), p, fid, t)

# ---------- 바닥 타일 ----------
def emit_tile(key, img):
    w, h, r = BD.pad_skirt(img, 101)
    BD.save(key + '.png', w, h, r)
    sprites[key] = {'file': key + '.png'}

emit_tile('ground/grass', BD.L('067'))
emit_tile('ground/grass_alt', BD.tint(BD.L('067'), 0.93))
emit_tile('ground/dirt', BD.L('073'))
emit_tile('ground/road', BD.C('080'))
emit_tile('ground/road_line', BD.C('112'))
emit_tile('ground/water', BD.L('066'))
emit_tile('ground/empty', BD.C('066'))

# ---------- 프롭 ----------
tree = BD.scale_nn(BD.load(BD.SRC_D % '010'), 2.0)
tw, th, tr = tree
BD.save('props/tree.png', tw, th, tr)
sprites['props/tree'] = {'file': 'props/tree.png', 'anchorX': 0.5, 'anchorY': 1.0, 'scale': 0.55}

for key, color, tag, frame in (('props/car_a', 'Blue', 'Blue2', 2), ('props/car_b', 'Red', 'Red2', 10)):
    img = BD.crop(read_png(VEH % (color, tag, frame)))
    w, h, r = BD.scale_nn(img, 2.0)
    BD.save(key + '.png', w, h, r)
    sprites[key] = {'file': key + '.png', 'anchorX': 0.5, 'anchorY': 1.0, 'scale': 0.78}

# 사람 둘은 people.mjs 가 캔버스로 그려 둔다 (Kenney 아이소 팩에 사람이 없다)
sprites['props/citizen'] = {'file': 'props/citizen.png', 'anchorX': 0.5, 'anchorY': 0.97, 'scale': 0.55}
sprites['props/worker'] = {'file': 'props/worker.png', 'anchorX': 0.5, 'anchorY': 0.97, 'scale': 0.55}

manifest = {
    '_readme': ('Kenney CC0 아이소 팩(Isometric City / Buildings / Landscape / Vehicles)을 '
                'tools/art-build 로 조립한 결과. 직접 손대지 말고 스크립트를 고쳐 다시 뽑는다. '
                'docs/ART.md 참고.'),
    '_license': 'Kenney (kenney.nl) — CC0 1.0. 사람 스프라이트 2종은 직접 그렸다.',
    'tileWidth': 132,
    'tileHeight': 66,
    'sprites': dict(sorted(sprites.items())),
}
with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(json.dumps({'sprites': len(sprites)}))
