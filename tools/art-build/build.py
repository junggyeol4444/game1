import os, math
from png import read_png, write_png, blit

_here = os.path.dirname(os.path.abspath(__file__))
_repo = os.path.dirname(os.path.dirname(_here))

# Kenney CC0 원본 팩이 풀려 있는 곳. tools/art-build/README.md 참고.
SRC = os.environ.get('KENNEY_SRC', '/tmp/kenney')
OUT = os.environ.get('ART_OUT', os.path.join(_repo, 'public', 'art'))

SRC_B = SRC + '/isometric-buildings/PNG/buildingTiles_%s.png'
SRC_C = SRC + '/isometriccity/PNG/cityTiles_%s.png'
SRC_D = SRC + '/isometriccity/Details/cityDetails_%s.png'
SRC_L = SRC + '/isometriclandscape/PNG/landscapeTiles_%s.png'

_cache = {}
def load(path):
    if path not in _cache: _cache[path] = read_png(path)
    return _cache[path]
def B(n): return load(SRC_B % n)
def C(n): return load(SRC_C % n)
def L(n): return load(SRC_L % n)

# ---- 2x2 부지 기하 ----
# 타일 하나 = 132 폭, 윗면 다이아몬드 66 높이. 2x2 부지의 화면 폭 = 264.
TW_S, TH_S = 132, 66
PLOT_W = 264
# (i,j) 타일 윗꼭짓점 (부지 이미지 좌표, 좌측 여백 66 포함)
def tile_top(i, j): return (66 + (i - j) * 66, (i + j) * 33)
def tile_center(i, j):
    x, y = tile_top(i, j)
    return (x + 66, y + 33)
PLOT_H = 33 * 2 + 101          # 마지막 타일 윗꼭짓점 66 + 타일 이미지 높이 101
GROUND_CX, GROUND_CY = 132, 66  # 부지 중심 (z=0)

FLOOR_W = 99                    # 건물 모듈 폭
FLOOR_HALF = FLOOR_W / 4        # 모듈 윗면 다이아몬드 반높이

def stack_height(mods):
    """모듈 목록을 쌓았을 때 맨 위 모듈의 이미지 상단이 바닥면 중심에서 몇 px 위인지."""
    y = 0.0                     # 바닥면 다이아몬드 중심 기준
    top = 0.0
    for m in mods:
        _, fh, _ = m
        Y = y - fh + FLOOR_HALF
        top = min(top, Y)
        y = Y + FLOOR_HALF
    return -top

def draw_stack(canvas, cw, ch, mods, cx, cy):
    """(cx, cy) = 바닥면 다이아몬드 중심. 아래에서 위로 쌓는다."""
    y = float(cy)
    for m in mods:
        fw, fh, fr = m
        Y = int(round(y - fh + FLOOR_HALF))
        X = int(round(cx - fw / 2))
        blit(canvas, cw, ch, fr, fw, fh, X, Y)
        y = Y + FLOOR_HALF

def compose(ground, slots, decos=None):
    """
    ground: 부지 4칸에 깔 타일 (132x101 이미지) — 하나 또는 4개
    slots:  [(i, j, [모듈...])] — 각 칸에 올릴 건물
    decos:  {(i, j): [(dx, dy, 이미지)]} — 나무 같은 소품
    반환: (w, h, rgba, anchorY)
    """
    decos = decos or {}
    stacks = {}
    top_need = 0
    for i, j, mods in slots:
        need = stack_height(mods)
        cx, cy = tile_center(i, j)
        top_need = max(top_need, need - cy)
        stacks[(i, j)] = mods
    for (i, j), items in decos.items():
        cx, cy = tile_center(i, j)
        for dx, dy, im in items:
            top_need = max(top_need, im[1] - (cy + dy))
    pad = int(math.ceil(max(0, top_need))) + 2
    W, H = PLOT_W, PLOT_H + pad
    canvas = bytearray(W * H * 4)

    order = [(0, 0), (1, 0), (0, 1), (1, 1)]
    for k, (i, j) in enumerate(order):
        g = ground[k % len(ground)]
        gw, gh, gr = g
        tx, ty = tile_top(i, j)
        blit(canvas, W, H, gr, gw, gh, tx + (TW_S - gw) // 2, ty + pad)
    for i, j in order:
        cx, cy = tile_center(i, j)
        mods = stacks.get((i, j))
        if mods:
            draw_stack(canvas, W, H, mods, cx, cy + pad)
        for dx, dy, im in sorted(decos.get((i, j), []), key=lambda d: d[1]):
            iw, ih, ir = im
            blit(canvas, W, H, ir, iw, ih, int(cx + dx - iw / 2), int(cy + dy + pad - ih))
    return W, H, canvas, (GROUND_CY + pad) / H

def save(name, w, h, rgba):
    p = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    write_png(p, w, h, rgba)

def tint(img, f, sat=1.0):
    w, h, r = img
    o = bytearray(r)
    for k in range(w * h):
        for c in range(3):
            v = o[k * 4 + c] * f
            o[k * 4 + c] = 0 if v < 0 else (255 if v > 255 else int(v))
    return (w, h, o)

def pad_skirt(img, target_h=101):
    """바닥 타일들의 블록 두께를 맞춘다 (마지막 줄을 아래로 늘림)."""
    w, h, r = img
    if h >= target_h: return img
    o = bytearray(w * target_h * 4)
    o[:w * h * 4] = r
    last = r[(h - 1) * w * 4:h * w * 4]
    for y in range(h, target_h):
        o[y * w * 4:(y + 1) * w * 4] = last
    return (w, target_h, o)

def scale_nn(img, f):
    w, h, r = img
    nw, nh = max(1, int(round(w * f))), max(1, int(round(h * f)))
    o = bytearray(nw * nh * 4)
    for y in range(nh):
        sy = min(h - 1, int(y / f))
        for x in range(nw):
            sx = min(w - 1, int(x / f))
            o[(y * nw + x) * 4:(y * nw + x) * 4 + 4] = r[(sy * w + sx) * 4:(sy * w + sx) * 4 + 4]
    return (nw, nh, o)

def crop(img):
    w, h, r = img
    x0, y0, x1, y1 = bbox_of(w, h, r)
    if x1 < x0: return img
    nw, nh = x1 - x0 + 1, y1 - y0 + 1
    o = bytearray(nw * nh * 4)
    for y in range(nh):
        o[y * nw * 4:(y + 1) * nw * 4] = r[((y + y0) * w + x0) * 4:((y + y0) * w + x1 + 1) * 4]
    return (nw, nh, o)

def bbox_of(w, h, rgba):
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        row = y * w * 4
        for x in range(w):
            if rgba[row + x * 4 + 3] > 8:
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
    return x0, y0, x1, y1

def pad_canvas(img, W, H, ox, oy):
    w, h, r = img
    o = bytearray(W * H * 4)
    blit(o, W, H, r, w, h, ox, oy)
    return (W, H, o)

def recolor(img, mode):
    """모듈 색을 바꾼다. Kenney 건물팩에 회색 벽 모듈이 없어서 크림색을 눌러 만든다."""
    if not mode: return img
    w, h, r = img
    o = bytearray(r)
    for k in range(w * h):
        if o[k * 4 + 3] == 0: continue
        R_, G_, B_ = o[k * 4], o[k * 4 + 1], o[k * 4 + 2]
        lum = 0.299 * R_ + 0.587 * G_ + 0.114 * B_
        if mode == 'grey':      nr, ng, nb = lum * 0.80, lum * 0.82, lum * 0.85
        elif mode == 'steel':   nr, ng, nb = lum * 0.70, lum * 0.74, lum * 0.80
        elif mode == 'navy':    nr, ng, nb = lum * 0.62, lum * 0.72, lum * 0.92
        elif mode == 'white':   nr, ng, nb = lum * 1.02 + 10, lum * 1.03 + 12, lum * 1.03 + 12
        elif mode == 'rust':    nr, ng, nb = lum * 1.00, lum * 0.78, lum * 0.58
        else:                   nr, ng, nb = R_, G_, B_
        o[k * 4]     = max(0, min(255, int(nr)))
        o[k * 4 + 1] = max(0, min(255, int(ng)))
        o[k * 4 + 2] = max(0, min(255, int(nb)))
    return (w, h, o)
