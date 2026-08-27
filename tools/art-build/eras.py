# -*- coding: utf-8 -*-
"""
시대별 건물 변형.

같은 부지에 문명이 바뀌면 완전히 다른 게 서야 한다. 그런데 Kenney 팩엔
현대 도시 모듈밖에 없어서, 기본 조리법(recipes.py)을 시대마다 이렇게 비튼다:

  floors  한 채가 올라갈 수 있는 층 수 상한   (석기 1층 ~ 우주 제한없음)
  slots   부지 4칸 중 실제로 채우는 칸 수      (석기 2칸 ~ 근대 이후 4칸)
  roofs   지붕 모양                            (초기 박공 -> 후기 평지붕)
  wall/roof  다시 칠할 색 (eras.ts 의 팔레트와 같은 값)
  ground  바닥 타일 강제 (없으면 조리법 그대로)

`modern` 은 기본본이 이미 근대 도시라 변형을 만들지 않는다 — 시대 전용 키가
없으면 게임이 자동으로 공통 키로 떨어진다 (`buildingKeysFor`).
"""

GABLE = ['057', '063', '073', '059']
STEEP = ['069', '074', '082', '075']
GREY  = ['080', '088', '089', '096']
FLAT  = ['005', '094', '121', '110']

ERA_STYLE = {
    'stone':       dict(floors=1, slots=2, roofs=GABLE, wall='#D8C9A3', roof='#8B6F47', ground=('L', '073')),
    'bronze':      dict(floors=1, slots=3, roofs=GABLE, wall='#E8DCC0', roof='#B5713F', ground=('L', '073')),
    'iron':        dict(floors=2, slots=3, roofs=GABLE, wall='#DCD3BE', roof='#8C5A3C', ground=None),
    # 중세는 목조 — 르네상스(밝은 회벽 + 붉은 기와)와 구분되게 벽을 어둡게 깐다
    'medieval':    dict(floors=2, slots=4, roofs=STEEP, wall='#C6B094', roof='#5A3A2C', ground=None),
    'renaissance': dict(floors=3, slots=4, roofs=STEEP, wall='#F2EADA', roof='#B5563F', ground=None),
    # 산업혁명은 그을음 — 팔레트 값(#D9D2C6/#8A4B3A)이 르네상스와 붙어서 더 눌렀다
    'industrial':  dict(floors=4, slots=4, roofs=GREY,  wall='#AFA79C', roof='#4A4844', ground=None),
    # modern = 기본본
    'information': dict(floors=None, slots=4, roofs=FLAT, wall='#EEF4F8', roof='#4A90D9', ground=None),
    'space':       dict(floors=None, slots=4, roofs=FLAT, wall='#DCE6F2', roof='#8B6DF0', ground=None),
}

# 부지에서 먼저 채우는 순서 (앞 -> 오른쪽 -> 왼쪽 -> 뒤)
SLOT_ORDER = [(1, 1), (1, 0), (0, 1), (0, 0)]


def restyle(plan, style, tier):
    """기본 조리법을 시대 규칙에 맞게 깎는다. (슬롯, 지붕 id, 층 수)"""
    by_cell = {(i, j): mods for i, j, mods in plan['slots']}
    keep = [c for c in SLOT_ORDER if c in by_cell][: style['slots']]
    out = []
    for n, cell in enumerate(keep):
        mods = by_cell[cell]
        floors, roof = mods[:-1], mods[-1]
        cap = style['floors']
        if cap is not None:
            # 티어가 오를수록 상한 안에서 조금씩 높아진다
            limit = max(1, min(cap, 1 + (tier - 1) // 2))
            floors = floors[:limit]
        out.append((cell[0], cell[1], list(floors), style['roofs'][n % len(style['roofs'])]))
    return out
