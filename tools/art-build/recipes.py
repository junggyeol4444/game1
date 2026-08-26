# -*- coding: utf-8 -*-
"""
Kenney 아이소 모듈을 게임이 요구하는 78개 스프라이트 키로 조립한다.
- 부지는 2x2 (게임의 LOTS 가 전부 2x2) -> 132px 타일 4장으로 바닥을 깔고
  각 칸 위에 99px 건물 모듈을 쌓는다.
- 티어가 오르면 (a) 건물 수가 늘고 (b) 층이 높아진다.
"""

# 층 모듈 (99x85)
GLASS   = ['000', '007', '015', '024', '031', '008']
GLASSR  = ['016', '023']
BROWN   = ['032', '038', '043', '047']
CREAM   = ['039', '044', '051', '053', '055', '056']
RED     = ['045', '049', '052', '054']
GREY    = ['048', '050']

# 지붕
FLAT      = ['005', '013', '086', '094', '102', '110', '119', '126']
TOWERTOP  = ['121', '128', '127']
G_CREAM   = ['057', '059', '063', '066', '073']
G_ORANGE  = ['062', '065', '068', '070']
C_ORANGE  = ['071', '077', '084']
G_RED     = ['069', '074', '075', '082']
C_RED     = ['083', '090', '091', '098']
G_GREY    = ['080', '088', '089', '096']
C_GREY    = ['104', '105', '112']

# 바닥
PAVE  = ('C', '066')
GRASS = ('L', '067')
WATER = ('L', '066')
DIRT  = ('L', '073')
ROAD  = ('C', '080')
LINE  = ('C', '112')

def S(*parts):
    """한 칸에 올릴 모듈 스택 (아래 -> 위)"""
    return list(parts)

# 칸 좌표: (0,0) 뒤, (1,0) 오른쪽, (0,1) 왼쪽, (1,1) 앞
BK, RT, LF, FR = (0, 0), (1, 0), (0, 1), (1, 1)

def plan(ground, *slots, **kw):
    return {'ground': ground,
            'slots': [(p[0], p[1], s) for p, s in slots],
            'tint': kw.get('tint'),
            'trees': kw.get('trees', 0)}

def tower(floor, n, roof):
    return [floor] * n + [roof]

BUSINESS = {
  # 광산 — 흙바닥, 갈색/회색, 낮고 넓게
  'mine': [
    plan(DIRT, (FR, S(BROWN[3], G_GREY[1]))),
    plan(DIRT, (FR, S(BROWN[3], G_GREY[1])), (LF, S(BROWN[0], G_GREY[3]))),
    plan(DIRT, (FR, S(BROWN[3], BROWN[1], G_GREY[1])), (LF, S(BROWN[0], G_GREY[3])),
               (RT, S(GREY[0], FLAT[2]))),
    plan(DIRT, (FR, S(BROWN[3], BROWN[1], G_GREY[1])), (LF, S(BROWN[0], BROWN[2], G_GREY[3])),
               (RT, S(GREY[0], FLAT[2])), (BK, S(BROWN[2], C_ORANGE[0]))),
    plan(DIRT, (FR, S(BROWN[3], BROWN[1], BROWN[0], G_GREY[1])),
               (LF, S(BROWN[0], BROWN[2], G_GREY[3])),
               (RT, S(GREY[0], GREY[1], FLAT[2])), (BK, S(BROWN[2], BROWN[3], C_ORANGE[0]))),
    plan(DIRT, (FR, S(BROWN[3], BROWN[1], BROWN[0], BROWN[2], G_GREY[1])),
               (LF, S(BROWN[0], BROWN[2], BROWN[1], G_GREY[3])),
               (RT, S(GREY[0], GREY[1], GREY[0], FLAT[2])),
               (BK, S(BROWN[2], BROWN[3], BROWN[0], C_ORANGE[0]))),
  ],
  # 공장 — 회색 + 굴뚝, 포장 바닥
  'factory': [
    plan(PAVE, (FR, S(GREY[0], G_GREY[0]))),
    plan(PAVE, (FR, S(GREY[0], GREY[1], G_GREY[0])), (RT, S(GREY[1], FLAT[3]))),
    plan(PAVE, (FR, S(GREY[0], GREY[1], G_GREY[0])), (RT, S(GREY[1], GREY[0], FLAT[3])),
               (LF, S(GREY[0], C_GREY[0]))),
    plan(PAVE, (FR, S(GREY[0], GREY[1], GREY[0], G_GREY[0])), (RT, S(GREY[1], GREY[0], FLAT[3])),
               (LF, S(GREY[0], GREY[1], C_GREY[0])), (BK, S(GREY[1], FLAT[5]))),
    plan(PAVE, (FR, S(GREY[0], GREY[1], GREY[0], GREY[1], G_GREY[0])),
               (RT, S(GREY[1], GREY[0], GREY[1], FLAT[3])),
               (LF, S(GREY[0], GREY[1], C_GREY[0])), (BK, S(GREY[1], GREY[0], FLAT[5]))),
    plan(PAVE, (FR, S(*tower(GREY[0], 5, G_GREY[0]))),
               (RT, S(*tower(GREY[1], 4, FLAT[3]))),
               (LF, S(*tower(GREY[0], 3, C_GREY[0]))),
               (BK, S(*tower(GREY[1], 4, FLAT[5])))),
  ],
  # 어항 — 물가, 크림/유리, 낮게 넓게
  'fishery': [
    plan((WATER, WATER, PAVE, PAVE), (FR, S(CREAM[0], G_CREAM[0]))),
    plan((WATER, WATER, PAVE, PAVE), (FR, S(CREAM[0], G_CREAM[0])), (RT, S(GLASS[5], FLAT[0]))),
    plan((WATER, PAVE, PAVE, PAVE), (FR, S(CREAM[0], CREAM[2], G_CREAM[0])),
               (RT, S(GLASS[5], FLAT[0])), (LF, S(CREAM[3], C_ORANGE[1]))),
    plan((WATER, PAVE, PAVE, PAVE), (FR, S(CREAM[0], CREAM[2], G_CREAM[0])),
               (RT, S(GLASS[5], GLASS[0], FLAT[0])), (LF, S(CREAM[3], CREAM[1], C_ORANGE[1])),
               (BK, S(CREAM[4], G_CREAM[2]))),
    plan((WATER, PAVE, PAVE, PAVE), (FR, S(CREAM[0], CREAM[2], CREAM[5], G_CREAM[0])),
               (RT, S(GLASS[5], GLASS[0], GLASS[2], FLAT[0])),
               (LF, S(CREAM[3], CREAM[1], C_ORANGE[1])), (BK, S(CREAM[4], CREAM[0], G_CREAM[2]))),
    plan((WATER, PAVE, PAVE, PAVE), (FR, S(*tower(CREAM[0], 4, G_CREAM[0]))),
               (RT, S(*tower(GLASS[5], 5, FLAT[0]))),
               (LF, S(*tower(CREAM[3], 3, C_ORANGE[1]))),
               (BK, S(*tower(CREAM[4], 4, G_CREAM[2])))),
  ],
  # 유원지 — 잔디, 알록달록한 지붕
  'park': [
    plan(GRASS, (FR, S(CREAM[1], G_RED[0]))),
    plan(GRASS, (FR, S(CREAM[1], G_RED[0])), (RT, S(GLASSR[0], C_RED[0]))),
    plan(GRASS, (FR, S(CREAM[1], G_RED[0])), (RT, S(GLASSR[0], GLASSR[1], C_RED[0])),
               (LF, S(CREAM[2], G_ORANGE[0]))),
    plan(GRASS, (FR, S(CREAM[1], CREAM[3], G_RED[0])), (RT, S(GLASSR[0], GLASSR[1], C_RED[0])),
               (LF, S(CREAM[2], G_ORANGE[0])), (BK, S(RED[0], C_RED[2]))),
    plan(GRASS, (FR, S(CREAM[1], CREAM[3], G_RED[0])),
               (RT, S(GLASSR[0], GLASSR[1], GLASSR[0], C_RED[0])),
               (LF, S(CREAM[2], CREAM[4], G_ORANGE[0])), (BK, S(RED[0], RED[1], C_RED[2]))),
    plan(GRASS, (FR, S(*tower(CREAM[1], 3, G_RED[0]))),
               (RT, S(*tower(GLASSR[0], 5, C_RED[0]))),
               (LF, S(*tower(CREAM[2], 3, G_ORANGE[0]))),
               (BK, S(*tower(RED[0], 4, C_RED[2])))),
  ],
  # 기업 — 유리 마천루, 가장 높게
  'corp': [
    plan(PAVE, (FR, S(GLASS[0], FLAT[0]))),
    plan(PAVE, (FR, S(GLASS[0], GLASS[1], FLAT[0])), (RT, S(GLASS[2], FLAT[4]))),
    plan(PAVE, (FR, S(*tower(GLASS[0], 3, FLAT[0]))), (RT, S(*tower(GLASS[2], 2, FLAT[4]))),
               (LF, S(*tower(GLASS[3], 2, TOWERTOP[0])))),
    plan(PAVE, (FR, S(*tower(GLASS[0], 5, FLAT[0]))), (RT, S(*tower(GLASS[2], 3, FLAT[4]))),
               (LF, S(*tower(GLASS[3], 3, TOWERTOP[0]))), (BK, S(*tower(GLASS[4], 2, FLAT[6])))),
    plan(PAVE, (FR, S(*tower(GLASS[0], 7, FLAT[0]))), (RT, S(*tower(GLASS[2], 5, FLAT[4]))),
               (LF, S(*tower(GLASS[3], 4, TOWERTOP[0]))), (BK, S(*tower(GLASS[4], 4, FLAT[6])))),
    plan(PAVE, (FR, S(*tower(GLASS[0], 10, FLAT[0]))), (RT, S(*tower(GLASS[2], 7, FLAT[4]))),
               (LF, S(*tower(GLASS[3], 6, TOWERTOP[0]))), (BK, S(*tower(GLASS[4], 6, FLAT[6])))),
  ],
}

FACILITY = {
  # 주거지 — 단독주택 -> 고층 아파트단지
  'housing': [
    plan(GRASS, (FR, S(CREAM[0], G_CREAM[0])), (RT, S(CREAM[2], G_CREAM[1]))),
    plan(GRASS, (FR, S(CREAM[0], CREAM[3], G_CREAM[0])), (RT, S(CREAM[2], G_CREAM[1])),
                (LF, S(CREAM[4], G_CREAM[3]))),
    plan(PAVE, (FR, S(*tower(CREAM[0], 4, FLAT[0]))), (RT, S(*tower(CREAM[2], 3, FLAT[1]))),
               (LF, S(*tower(CREAM[4], 3, FLAT[2]))), (BK, S(*tower(CREAM[5], 2, FLAT[3])))),
    plan(PAVE, (FR, S(*tower(CREAM[0], 7, TOWERTOP[0]))), (RT, S(*tower(CREAM[2], 6, TOWERTOP[1]))),
               (LF, S(*tower(CREAM[4], 5, FLAT[2]))), (BK, S(*tower(CREAM[5], 5, FLAT[3])))),
  ],
  # 상가 — 노점 -> 백화점
  'shops': [
    plan(PAVE, (FR, S(GLASS[0], FLAT[0]))),
    plan(PAVE, (FR, S(GLASS[0], GLASS[5], FLAT[0])), (RT, S(GLASSR[0], FLAT[1]))),
    plan(PAVE, (FR, S(*tower(GLASS[0], 3, FLAT[0]))), (RT, S(*tower(GLASSR[0], 2, FLAT[1]))),
               (LF, S(*tower(GLASS[1], 2, FLAT[2])))),
    plan(PAVE, (FR, S(*tower(GLASS[0], 5, FLAT[0]))), (RT, S(*tower(GLASSR[0], 4, FLAT[1]))),
               (LF, S(*tower(GLASS[1], 3, FLAT[2]))), (BK, S(*tower(GLASS[3], 3, FLAT[3])))),
  ],
  # 도로 — 흙길 -> 입체 교차로 (건물 없이 노면으로 보여준다)
  'road': [
    plan(DIRT),
    plan(ROAD),
    plan(LINE),
    plan((LINE, ROAD, ROAD, LINE), (BK, S(GREY[0], FLAT[3]))),
  ],
  # 발전소 — 회색 + 높은 굴뚝
  'power': [
    plan(DIRT, (FR, S(GREY[0], G_GREY[0])), (BK, S(*tower(GREY[1], 3, FLAT[0])))),
    plan(PAVE, (FR, S(GREY[0], GREY[1], G_GREY[0])), (BK, S(*tower(GREY[1], 5, FLAT[0]))),
               (RT, S(GREY[0], C_GREY[0]))),
    plan(PAVE, (FR, S(*tower(GREY[0], 3, G_GREY[0]))), (BK, S(*tower(GREY[1], 7, FLAT[0]))),
               (RT, S(*tower(GREY[0], 2, C_GREY[0]))), (LF, S(*tower(GREY[1], 2, FLAT[2])))),
    plan(PAVE, (FR, S(*tower(GREY[0], 4, G_GREY[0]))), (BK, S(*tower(GREY[1], 9, FLAT[0]))),
               (RT, S(*tower(GREY[0], 4, C_GREY[0]))), (LF, S(*tower(GREY[1], 4, FLAT[2])))),
  ],
  # 학교 — 크림 + 빨간 박공
  'school': [
    plan(GRASS, (FR, S(CREAM[2], G_RED[0]))),
    plan(GRASS, (FR, S(CREAM[2], CREAM[0], G_RED[0])), (RT, S(CREAM[3], G_RED[1]))),
    plan(GRASS, (FR, S(*tower(CREAM[2], 3, G_RED[0]))), (RT, S(*tower(CREAM[3], 2, G_RED[1]))),
                (LF, S(CREAM[1], FLAT[0]))),
    plan(PAVE, (FR, S(*tower(CREAM[2], 4, G_RED[0]))), (RT, S(*tower(CREAM[3], 4, G_RED[1]))),
               (LF, S(*tower(CREAM[1], 3, FLAT[0]))), (BK, S(*tower(CREAM[5], 3, FLAT[1])))),
  ],
  # 병원 — 흰색/회색 + 평지붕
  'hospital': [
    plan(PAVE, (FR, S(GREY[1], FLAT[0]))),
    plan(PAVE, (FR, S(GREY[1], RED[3], FLAT[0])), (RT, S(GREY[0], FLAT[1]))),
    plan(PAVE, (FR, S(*tower(GREY[1], 4, FLAT[0]))), (RT, S(*tower(GREY[0], 3, FLAT[1]))),
               (LF, S(RED[3], FLAT[2]))),
    plan(PAVE, (FR, S(*tower(GREY[1], 6, TOWERTOP[0]))), (RT, S(*tower(GREY[0], 5, FLAT[1]))),
               (LF, S(*tower(RED[3], 3, FLAT[2]))), (BK, S(*tower(GREY[1], 4, FLAT[3])))),
  ],
  # 공원 — 잔디 + 나무 (건물은 최소)
  'green': [
    plan(GRASS),
    plan(GRASS, (BK, S(CREAM[1], G_CREAM[0]))),
    plan(GRASS, (BK, S(CREAM[1], G_CREAM[0])), (RT, S(CREAM[3], G_ORANGE[0]))),
    plan(GRASS, (BK, S(CREAM[1], CREAM[2], G_CREAM[0])), (RT, S(CREAM[3], G_ORANGE[0])),
                (LF, S(CREAM[0], C_ORANGE[0]))),
  ],
  # 소방서 — 빨간 건물
  'fire': [
    plan(PAVE, (FR, S(RED[0], FLAT[0]))),
    plan(PAVE, (FR, S(RED[0], RED[1], FLAT[0])), (RT, S(RED[2], G_RED[2]))),
    plan(PAVE, (FR, S(*tower(RED[0], 3, FLAT[0]))), (RT, S(*tower(RED[2], 2, G_RED[2]))),
               (LF, S(RED[3], FLAT[1]))),
    plan(PAVE, (FR, S(*tower(RED[0], 5, FLAT[0]))), (RT, S(*tower(RED[2], 3, G_RED[2]))),
               (LF, S(*tower(RED[3], 3, FLAT[1]))), (BK, S(*tower(RED[1], 3, FLAT[2])))),
  ],
  # 경찰서 — 회색/유리
  'police': [
    plan(PAVE, (FR, S(GREY[0], FLAT[1]))),
    plan(PAVE, (FR, S(GREY[0], GLASS[4], FLAT[1])), (RT, S(GREY[1], FLAT[2]))),
    plan(PAVE, (FR, S(*tower(GREY[0], 3, FLAT[1]))), (RT, S(*tower(GREY[1], 3, FLAT[2]))),
               (LF, S(GLASS[4], C_GREY[1]))),
    plan(PAVE, (FR, S(*tower(GREY[0], 5, FLAT[1]))), (RT, S(*tower(GREY[1], 4, FLAT[2]))),
               (LF, S(*tower(GLASS[4], 3, C_GREY[1]))), (BK, S(*tower(GREY[0], 3, FLAT[3])))),
  ],
}
