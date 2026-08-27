# 아트 에셋 넣는 법

게임 실행 중에는 건물·캐릭터·차량·타일을 `public/art/` PNG에서 읽는다. 다만 현재 PNG는
대부분 조립 코드로 만든 **프로토타입 아트**다. 최종본은 GPT 생성 또는 수작업 이미지로 교체한다.
파일이 없으면 회색 플레이스홀더가 뜬다.

```bash
npm run art:check          # 필요한 스프라이트 78개와 누락 현황
npm run art:check -- --csv # 외주 발주용 CSV
```

---

## 1. 지금 상태

**시대 공통 78 / 78, 시대 전용 496 / 702가 들어와 있다.** 필수 플레이스홀더는 더 안 나오지만,
최종 품질 아트가 완료됐다는 뜻은 아니다.

출처는 **Kenney CC0 아이소 팩** — `Isometric City`, `Isometric Buildings`,
`Isometric Landscape`, `Isometric Vehicles`. 표기 의무 없이 상업적 사용이 된다.
(kenney.nl 은 이 환경의 프록시가 막아서, GitHub 의 CC0 미러 `ETdoFresh/kenney.nl` 에서 받았다.)

`public/art/` 의 PNG 는 전부 **조립된 결과물**이다. 손으로 고치지 말고 조리법을 고쳐서 다시 뽑는다:

```bash
npm run art:build          # tools/art-build/ 참고 — 원본 팩 경로가 필요하다
npm run art:check          # 필수 78 / 78 확인
```

**왜 조립하나.** Kenney 팩은 완성된 건물이 아니라 모듈(바닥 타일 · 층 · 지붕)이다.
게임은 66채 × 단계별 성장이 필요해서, 단계가 오를수록 **건물 수가 늘고 층이 높아지도록** 쌓는다.
조리법은 `tools/art-build/recipes.py` 한 파일에 다 있다.

건물 종류별 색은 팩에 없는 것도 있어서(회색·남색 벽 모듈이 없다) 크림색 모듈의 명도만 남기고
다시 칠한다 — 공장은 강철색, 경찰서는 남색, 병원은 흰색. `build.py` 의 `recolor()`.

사람 2종(`props/citizen`, `props/worker`)은 아이소 사람 팩이 없어서 직접 그렸다
(`tools/art-build/people.mjs`, Chromium 캔버스).

**시대별로 다른 건물.** 팩엔 현대 도시 모듈뿐이라, 같은 조리법을 시대마다 비틀어 뽑는다
(`tools/art-build/eras.py`) — 층 수 상한, 부지에 채우는 칸 수, 지붕 모양, 벽/지붕 색.

| 시대 | 층 상한 | 칸 | 지붕 | 느낌 |
|---|---|---|---|---|
| 석기 | 1 | 2 | 박공 | 흙바닥 위 낮은 오두막 |
| 청동기 | 1 | 3 | 박공 | 흙바닥, 주황 지붕 |
| 철기 | 2 | 3 | 박공 | 2층 석조 |
| 중세 | 2 | 4 | 급경사 | 어두운 목조 |
| 르네상스 | 3 | 4 | 급경사 | 밝은 회벽 + 붉은 기와 |
| 산업혁명 | 4 | 4 | 회색 | 그을음 |
| 근대 | 제한없음 | 4 | 평지붕 | **기본본** — 시대 전용을 안 만든다 |
| 정보화 | 제한없음 | 4 | 평지붕 | 흰 벽 + 파란 평지붕 |
| 우주 | 제한없음 | 4 | 평지붕 | 흰 벽 + 보라 평지붕 |

한 시대만 다시 뽑으려면 인자로 준다 (전체는 20분 넘게 걸린다):

```bash
KENNEY_SRC=/tmp/kenney-src python3 tools/art-build/make.py medieval industrial
```

인자를 주면 `manifest.json` 은 건드리지 않는다 — 키 목록이 안 바뀌기 때문이다.

**용량.** PNG 는 인덱스(256색)로 저장한다. 이 아트는 단색 면 위주라 색이 몇 개 안 되고,
픽셀당 32비트가 8비트로 줄어 파일이 3~4배 작아진다 (RGBA 로 뽑으면 574장에 14MB,
인덱스로 4.7MB). `png.py` 가 두 방식으로 다 압축해 보고 작은 쪽을 쓴다.

**불러오기.** `loadArt()` 는 **시대 공통 78장만** 미리 받는다. 574장을 다 받으면
첫 화면이 4MB 를 기다린다. 시대 전용은 그 시대 지도를 그릴 때 `ensureEra()` 가 받고,
아직 안 받았으면 공통 키로 떨어져서 화면은 어차피 나온다.

---

## 2. 규격

- **투영**: 2:1 아이소메트릭. 타일 폭:높이 = 2:1 (게임 내부 기본 64×32, 지금 아트는 132×66)
- **각도**: 카메라 회전 없음. 모든 건물이 같은 방향
- **형식**: PNG, 투명 배경
- **크기**: 건물 1채 = 2×2 타일 부지 → 지금 아트는 폭 **264px** (높이는 자유)
- **바닥 기준선**: 스프라이트 하단 중앙이 부지 바닥 중심에 놓인다.
  기준점이 다르면 `manifest.json` 의 `anchorX` / `anchorY` 로 보정한다
- **바닥 타일**(`ground/*`)만 규칙이 다르다: 윗면 다이아몬드의 **위 꼭짓점이 이미지 y=0**.
  `anchorX`/`anchorY` 를 안 본다. 아래로 남는 부분은 블록 옆면으로 흘러내린다

```
        ╱╲          ← 건물 (높이 자유)
       ╱  ╲
      ╱____╲
     ╱      ╲       ← 부지 2×2 타일 (폭 264px)
     ╲      ╱
      ╲____╱
         ▲
    anchorY = 1.0 (하단), anchorX = 0.5 (중앙)
```

---

## 3. manifest.json

```json
{
  "tileWidth": 132,
  "tileHeight": 66,
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

## 4. 필요한 스프라이트

`npm run art:check` 가 전체 목록을 뽑는다. 요약:

| 분류 | 개수 | 키 |
|---|---|---|
| 사업 건물 | 30 | `buildings/{mine,factory,fishery,park,corp}_{1..6}` |
| 시설 건물 | 36 | `buildings/{housing,shops,road,power,school,hospital,green,fire,police}_{1..4}` |
| 바닥 타일 | 7 | `ground/{grass,grass_alt,dirt,road,road_line,water,empty}` |
| 소품 | 5 | `props/{tree,car_a,car_b,citizen,worker}` |

전부 들어와 있다. 바꾸고 싶으면 `tools/art-build/recipes.py`(모양) 또는
`tools/art-build/eras.py`(시대별 변형)를 고치고 `npm run art:build`.

### 4-1. 시대 전용 변형 (선택)

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
- 지금 496개가 들어와 있다: 8개 시대 × 건물 62개
  (근대는 기본본이 곧 근대라 안 만들고, 도로·공원처럼 건물이 없는 단계도 공통본으로 충분하다).
- 바닥·소품의 시대 전용은 아직 없다 — 공통본이 받아준다.
- 목록: `npm run art:check --all`, 외주용 CSV 는 `npm run art:check -- --csv`.

---

## 5. 바꾸고 확인하기

```bash
# 1. 조리법을 고친다
$EDITOR tools/art-build/recipes.py

# 2. 다시 뽑는다 (원본 팩 경로 필요 — tools/art-build/README.md)
KENNEY_SRC=/tmp/kenney-src npm run art:build

# 3. 확인
npm run art:check
npm run dev
```

팩 밖의 그림을 직접 넣고 싶으면 `public/art/` 에 파일을 두고 `manifest.json` 에 등록해도 된다.
단 다음 `npm run art:build` 가 `manifest.json` 을 통째로 다시 쓴다 — 조리법 쪽에 반영해 두는 게 안전하다.

등록 안 된 키는 콘솔에 `[art] 스프라이트 없음: buildings/mine_2` 로 찍힌다.

`npm run art:check` 는 manifest 자체도 검사한다. 아트를 넣고 **"왜 회색 상자만 나오지"**
하는 원인 대부분이 여기다:

```
❓ buildings/mine1 — 게임이 안 쓰는 키입니다 (오타?)
⚠ ground/grass — 'file' 이 비어 있습니다
⚠ props/tree — 파일이 없습니다: public/art/props/tree.png
⚠ props/tree — anchorY 가 범위를 벗어났습니다: 5 (0~1)
❌ manifest.json 을 읽지 못했습니다: Unexpected end of JSON input
```

키 오타는 게임 쪽에서 조용히 플레이스홀더가 되므로 여기서 안 잡으면 못 찾는다.
