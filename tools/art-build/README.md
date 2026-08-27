# art-build — 스프라이트 조립기

`public/art/` 의 78개 스프라이트를 **Kenney CC0 아이소 팩에서 조립해서** 뽑는다.
`public/art/` 안의 PNG 는 전부 이 스크립트의 산출물이다. **손으로 고치지 말고 여기를 고쳐서 다시 뽑는다.**

## 왜 조립하나

Kenney 팩은 완성된 건물이 아니라 **모듈**이다 — 바닥 타일(132px), 층(99×85), 지붕(99×54~63).
게임은 사업 5종 × 6단계 + 시설 9종 × 4단계 = 66채가 필요하고,
단계가 오를수록 **건물이 늘고 층이 높아져야** 한다. 그래서 모듈을 쌓아서 만든다.

부지는 전부 2×2 (`LOTS`) 라서 132px 타일 4장으로 바닥을 깔고, 네 칸 위에 각각 탑을 쌓는다.

## 쓰는 법

```bash
# 1. 원본 팩 받기 (CC0 미러)
git clone --filter=blob:none --no-checkout --depth 1 \
  https://github.com/ETdoFresh/kenney.nl /tmp/kenney-src
cd /tmp/kenney-src
git sparse-checkout set isometriccity isometric-buildings isometriclandscape isometricvehicles
git checkout

# 2. 조립
KENNEY_SRC=/tmp/kenney-src python3 tools/art-build/make.py
node tools/art-build/people.mjs        # 사람 2종 (팩에 아이소 사람이 없다)

# 3. 확인
npm run art:check                      # 필수 78 / 78 이어야 한다
```

환경변수: `KENNEY_SRC` (기본 `/tmp/kenney`), `ART_OUT` (기본 `public/art`).
파이썬 외부 의존성 없음 — `png.py` 가 zlib 만으로 PNG 를 읽고 쓴다.

## 파일

| 파일 | 하는 일 |
|---|---|
| `png.py` | PNG 디코드/인코드, 알파 합성, 크롭, 확대 (의존성 없음) |
| `build.py` | 2×2 부지 기하, 모듈 쌓기, 색조 변경, 경로 설정 |
| `recipes.py` | **건물 조리법.** 어떤 모듈을 몇 층 쌓을지 — 여기를 고치면 그림이 바뀐다 |
| `make.py` | 전체를 돌려 PNG + `manifest.json` 을 뽑는다 |
| `people.mjs` | 시민·작업자 (Chromium 캔버스로 직접 그린다) |

## 기하 (고치기 전에 읽을 것)

- 타일 한 칸 = **132px 폭**, 윗면 다이아몬드 **66px 높이** (2:1)
- 건물 모듈 = **99px 폭**, 윗면 다이아몬드 반높이 = 99/4 ≈ 24.75px
- 모듈을 위에 쌓을 때: `Y = (아래 모듈 윗면 중심) - 모듈높이 + 24.75`
- 2×2 부지 이미지 = **264 × (167 + 위쪽여백)**, 부지 바닥 중심 = `(132, 66 + 여백)`
  → `manifest.json` 의 `anchorY = (66 + 여백) / 높이`

## 라이선스

원본: Kenney (kenney.nl) — **CC0 1.0**. 표기 의무 없음. 상업적 사용 가능.
`props/citizen.png`, `props/worker.png` 두 장은 이 저장소에서 직접 그렸다.
