/**
 * 스프라이트 에셋 로더.
 *
 * 규칙:
 *  - public/art/manifest.json 에 등록된 이미지를 미리 불러온다.
 *  - 등록되지 않았거나 파일이 없으면 **플레이스홀더**(회색 박스 + 키 이름)를 그린다.
 *    일부러 못생기게 둔다. 임시 그림을 진짜 아트로 착각하지 않게 하기 위해서다.
 *  - 코드로 건물을 그리지 않는다. 아트는 전부 이 폴더의 파일에서 온다.
 */
import { alpha } from '../../data/palette';
import { TW, project, type Cam, type Ctx } from '../scene/iso';

export interface SpriteEntry {
  /** public/art 기준 상대 경로 */
  file: string;
  /** 스프라이트 안에서 타일 바닥 중심이 놓인 위치 (0~1) */
  anchorX?: number;
  anchorY?: number;
  /** 부지 폭(타일) 대비 확대율 */
  scale?: number;
}

export interface ArtManifest {
  /** 아트 팩의 기준 타일 크기 (없으면 게임 기본값) */
  tileWidth?: number;
  tileHeight?: number;
  sprites: Record<string, SpriteEntry>;
}

const images = new Map<string, HTMLImageElement>();
/** 밝기를 눌러 둔 사본. 밤/체크무늬/물결은 프레임마다 같은 값이 반복돼서 캐시가 잘 먹는다 */
const shaded = new Map<string, CanvasImageSource>();
/**
 * 사본 상한. 건물 스프라이트 한 장이 264×400 이면 비트맵으로 400KB 가 넘는다 —
 * 무제한으로 두면 저사양 폰에서 메모리가 샌다. 넘치면 통째로 비우고 다시 쌓는다
 * (실제로 쓰이는 계수는 키당 두어 개뿐이라 넘칠 일이 잘 없다).
 */
const SHADE_CACHE_MAX = 160;
let manifest: ArtManifest = { sprites: {} };
let missingLogged = new Set<string>();

export function manifestSize(): number {
  return Object.keys(manifest.sprites).length;
}

export async function loadArt(base = './art/'): Promise<void> {
  try {
    const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    manifest = (await res.json()) as ArtManifest;
  } catch {
    manifest = { sprites: {} };
  }
  shaded.clear();
  const entries = Object.entries(manifest.sprites ?? {});
  await Promise.all(
    entries.map(
      ([key, entry]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(key, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `${base}${entry.file}`;
        }),
    ),
  );
}

export function hasSprite(key: string): boolean {
  return images.has(key);
}

/**
 * 밝기 계수를 먹인 스프라이트.
 *
 * 스프라이트로 갈아타면서 밤이 와도 땅이 안 어두워지는 문제가 생겼다 —
 * 예전에는 타일 색을 코드가 직접 칠했기 때문에 `shade()` 한 방이면 됐다.
 * 이미지는 그렇게 못 하니 곱셈 합성한 사본을 만들어 캐시한다.
 * 계수는 0.02 단위로 뭉쳐서 사본 수를 몇 개로 묶는다.
 */
function shadedImage(key: string, img: HTMLImageElement, f: number): CanvasImageSource {
  const q = Math.round(Math.max(0.2, Math.min(1, f)) * 50);
  if (q >= 50) return img;
  const id = `${key}|${q}`;
  const hit = shaded.get(id);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  const v = Math.round((q / 50) * 255);
  g.fillStyle = `rgb(${v},${v},${v})`;
  g.fillRect(0, 0, c.width, c.height);
  // 곱셈은 투명한 데까지 칠하므로 원본 알파로 다시 오린다
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  if (shaded.size >= SHADE_CACHE_MAX) shaded.clear();
  shaded.set(id, c);
  return c;
}

/**
 * 부지 (gx, gy, w, d) 위에 스프라이트를 놓는다.
 * 스프라이트 바닥 중심을 타일 바닥 중심에 맞춘다.
 */
export function drawSprite(
  ctx: Ctx,
  cam: Cam,
  key: string,
  gx: number,
  gy: number,
  w: number,
  d: number,
  shadeF = 1,
): boolean {
  const img = images.get(key);
  if (!img) return false;
  const entry = manifest.sprites[key] ?? { file: '' };
  const anchorX = entry.anchorX ?? 0.5;
  const anchorY = entry.anchorY ?? 1;
  const scale = entry.scale ?? 1;

  // 부지 폭(아이소 화면 폭)에 맞춘다
  const footprintW = (w + d) * (TW / 2) * cam.zoom * scale;
  const drawW = footprintW;
  const drawH = (img.height / img.width) * drawW;
  const [bx, by] = project(gx + w / 2, gy + d / 2, 0, cam);
  ctx.drawImage(shadedImage(key, img, shadeF), bx - drawW * anchorX, by - drawH * anchorY, drawW, drawH);
  return true;
}

/**
 * 바닥 타일 스프라이트.
 *
 * 타일 그림은 **윗면 다이아몬드의 위 꼭짓점이 이미지 y=0** 이라는 약속으로 만든다
 * (아이소 팩들이 다 그렇다). 그래서 이미지 왼쪽 위를 다이아몬드 윗꼭짓점에 그냥 맞추면
 * 윗면이 정확히 겹치고, 남는 아래쪽은 블록 옆면으로 흘러내린다.
 * 폭을 TW 에 맞추면 윗면 높이는 자동으로 TH 가 된다 (2:1 이라서).
 */
export function drawTileSprite(ctx: Ctx, cam: Cam, key: string, gx: number, gy: number, shadeF = 1): boolean {
  const img = images.get(key);
  if (!img) return false;
  const w = TW * cam.zoom;
  const h = (img.height / img.width) * w;
  const [px, py] = project(gx, gy, 0, cam);
  ctx.drawImage(shadedImage(key, img, shadeF), px - w / 2, py, w, h);
  return true;
}

/**
 * 에셋이 없을 때 그리는 플레이스홀더.
 * 일부러 단순하게 — "여기 아트가 들어와야 한다"가 보이도록.
 */
export function placeholder(
  ctx: Ctx,
  cam: Cam,
  key: string,
  gx: number,
  gy: number,
  w: number,
  d: number,
  label: string,
): void {
  if (!missingLogged.has(key)) {
    missingLogged.add(key);
    console.info(`[art] 스프라이트 없음: ${key}`);
  }
  const c = [
    project(gx, gy, 0, cam),
    project(gx + w, gy, 0, cam),
    project(gx + w, gy + d, 0, cam),
    project(gx, gy + d, 0, cam),
  ];
  // 부지
  ctx.beginPath();
  ctx.moveTo(c[0][0], c[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(c[i][0], c[i][1]);
  ctx.closePath();
  ctx.fillStyle = alpha('#8FA3B8', 0.55);
  ctx.fill();
  ctx.strokeStyle = alpha('#5A6C80', 0.9);
  ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
  ctx.setLineDash([6 * cam.zoom, 5 * cam.zoom]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 박스
  const [cx, cy] = project(gx + w / 2, gy + d / 2, 0, cam);
  const bw = (w + d) * (TW / 2) * cam.zoom * 0.5;
  const bh = bw * 0.75;
  ctx.fillStyle = alpha('#B9C6D4', 0.95);
  ctx.fillRect(cx - bw / 2, cy - bh, bw, bh);
  ctx.strokeStyle = '#6C7C8E';
  ctx.strokeRect(cx - bw / 2, cy - bh, bw, bh);

  const fs = Math.max(8, 10 * cam.zoom);
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = '#41505F';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - bh / 2);
  ctx.font = `${fs * 0.85}px system-ui, sans-serif`;
  ctx.fillText('art 없음', cx, cy - bh / 2 + fs * 1.1);
  ctx.textAlign = 'left';
}

/** 평면(비아이소) 화면용 스프라이트. 바닥 중앙 기준 */
export function drawSpriteFlat(ctx: Ctx, key: string, x: number, y: number, height: number): boolean {
  const img = images.get(key);
  if (!img) return false;
  const w = (img.width / img.height) * height;
  ctx.drawImage(img, x - w / 2, y - height, w, height);
  return true;
}
