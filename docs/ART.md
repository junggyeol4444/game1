# 아트 에셋 넣는 법

이 게임은 **그림을 코드로 그리지 않는다.** 건물·캐릭터·차량·타일은 전부
`public/art/` 의 이미지 파일에서 온다. 파일이 없으면 회색 플레이스홀더가 뜬다.

```bash
npm run art:check          # 필요한 스프라이트 78개와 누락 현황
npm run art:check -- --csv # 외주 발주용 CSV
```

---

## 1. 지금 상태

**스프라이트 0 / 78.** 전부 플레이스홀더다.

이 저장소 안에서 아트를 만들 수 없다 —
이미지 생성 수단이 없고, kenney.nl · OpenGameArt 같은 에셋 사이트는 이 환경의 프록시가 막는다.
그래서 **아트는 넣어 주셔야 하고, 코드는 넣으면 바로 붙도록 되어 있다.**

넘겨주는 방법 두 가지:
1. 파일을 `public/art/` 에 넣고 `manifest.json` 에 등록 → 그대로 뜬다
2. 공개 GitHub 저장소 URL을 주면 (raw.githubusercontent.com 은 접근 가능) 내가 받아서 등록한다

---

## 2. 어떤 팩을 쓰나

기획서 아트 문서 11장: *"1단계 프로토타입 — 에셋스토어 저폴리 팩 사용. 아트 자체 제작 안 함."*

요구 조건: **고정 아이소메트릭 · 저폴리 · 밝은 톤 · 상업적 사용 가능**

| 후보 | 라이선스 | 비고 |
|---|---|---|
| Kenney *Isometric City* / *City Kit (Commercial·Suburban)* | CC0 | 무료. 아이소 각도·톤이 기획서와 거의 일치 |
| Kenney *Isometric Vehicles* / *Isometric Miniature Library* | CC0 | 차량·소품 보충 |
| Unity Asset Store *Low Poly City* 계열 | 유료 | 3D 모델. Unity로 갈 때 |
| Synty *POLYGON City* | 유료 | 3D. 물량은 가장 많음 |

CC0(Kenney)이면 저작권 표기 없이 상업적 사용이 된다. 1단계 프로토타입은 이걸로 충분하다.

3D 모델(FBX/GLB)을 쓸 경우: 이 빌드는 2D 캔버스라 **각 건물을 고정 각도에서 렌더해 PNG로 뽑아**
넣으면 된다. 각도는 아래 규격과 맞춘다.

---

## 3. 규격

- **투영**: 2:1 아이소메트릭. 타일 폭:높이 = 2:1 (게임 내부 기본 64×32, 아트는 128×64 권장)
- **각도**: 카메라 회전 없음. 모든 건물이 같은 방향
- **형식**: PNG, 투명 배경
- **크기**: 건물 1채 = 2×2 타일 부지 → 권장 폭 **256px** (높이는 자유)
- **바닥 기준선**: 스프라이트 하단 중앙이 부지 바닥 중심에 놓인다.
  기준점이 다르면 `manifest.json` 의 `anchorX` / `anchorY` 로 보정한다

```
        ╱╲          ← 건물 (높이 자유)
       ╱  ╲
      ╱____╲
     ╱      ╲       ← 부지 2×2 타일 (폭 256px)
     ╲      ╱
      ╲____╱
         ▲
    anchorY = 1.0 (하단), anchorX = 0.5 (중앙)
```

---

## 4. manifest.json

```json
{
  "tileWidth": 128,
  "tileHeight": 64,
  "sprites": {
    "buildings/mine_1":  { "file": "buildings/mine_1.png" },
    "buildings/mine_2":  { "file": "buildings/mine_2.png", "anchorY": 0.92 },
    "ground/grass":      { "file": "ground/grass.png" },
    "props/tree":        { "file": "props/tree.png", "scale": 0.6 }
  }
}
```

| 필드 | 기본값 | 뜻 |
|---|---|---|
| `file` | — | `public/art/` 기준 상대 경로 |
| `anchorX` | 0.5 | 스프라이트 가로에서 바닥 중심 위치 (0~1) |
| `anchorY` | 1.0 | 스프라이트 세로에서 바닥 위치 (1 = 맨 아래) |
| `scale` | 1 | 부지 폭 대비 확대율 |

---

## 5. 필요한 스프라이트

`npm run art:check` 가 전체 목록을 뽑는다. 요약:

| 분류 | 개수 | 키 |
|---|---|---|
| 사업 건물 | 30 | `buildings/{mine,factory,fishery,park,corp}_{1..6}` |
| 시설 건물 | 36 | `buildings/{housing,shops,road,power,school,hospital,green,fire,police}_{1..4}` |
| 바닥 타일 | 7 | `ground/{grass,grass_alt,dirt,road,road_line,water,empty}` |
| 소품 | 5 | `props/{tree,car_a,car_b,citizen,worker}` |

**우선순위**: 1단계 프로토타입은 광산만 검증하므로
`buildings/mine_1..6` + `ground/*` + `props/*` 17개만 있으면 화면이 완성된다.

### 5-1. 시대 전용 변형 (선택)

문명이 바뀌면 같은 부지에 완전히 다른 건물이 선다. 그리는 쪽은 **시대 전용 키를 먼저 찾고,
없으면 시대 공통 키로 떨어진다** (`src/ui/art/keys.ts` `buildingKeysFor`).

```
buildings/stone/mine_3      ← 있으면 석기 시대에서 이걸 쓴다
buildings/mine_3            ← 없으면 이걸 쓴다 (시대 공통 · 필수)
ground/stone/grass          ← 타일·소품도 같은 규칙
```

시대 id: `stone bronze iron medieval renaissance industrial modern information space`
(`src/data/eras.ts`).

- **필수는 시대 공통 78개뿐이다.** 이것만 있으면 9개 문명 전부 돌아간다.
- 시대 전용은 702개(9 × 78)까지 열려 있지만 전부 그릴 필요는 없다.
  체감이 큰 것부터 — `buildings/<시대>/{mine,housing,power}_*` 와 `ground/<시대>/grass` 정도면
  문명이 바뀐 느낌이 난다. 나머지는 공통본이 받아준다.
- 목록: `npm run art:check --all`, 외주용 CSV 는 `npm run art:check -- --csv`.

---

## 6. 넣고 확인하기

```bash
# 1. 파일 복사
cp -r ~/Downloads/kenney_isometric-city/PNG/* public/art/buildings/

# 2. manifest.json 에 등록

# 3. 확인
npm run art:check
npm run dev
```

등록 안 된 키는 콘솔에 `[art] 스프라이트 없음: buildings/mine_2` 로 찍힌다.
