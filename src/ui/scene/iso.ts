/**
 * 고정 아이소메트릭 투영 + 캔버스 유틸.
 *
 * **여기서 그림을 그리지 않는다.** 건물·시민·차량은 전부 `public/art` 의 스프라이트에서 온다
 * (`ui/art/assets.ts`). 예전에는 이 파일이 건물을 코드로 그렸는데(box/gableRoof/cylinder/car…),
 * 아트를 에셋 파일로 옮기면서 전부 지웠다. 남은 건 좌표 변환과 캔버스 크기 맞추기뿐이다.
 *
 * 규격: 회전 없음 · 2:1 다이아몬드 타일 · 확대/이동만.
 */

export type Ctx = CanvasRenderingContext2D;

/** 타일 크기 */
export const TW = 64;
export const TH = 32;
/** 높이 1단위의 화면 픽셀 */
export const ZH = 24;

export interface Cam {
  /** 화면 중심이 보는 월드 좌표 */
  x: number;
  y: number;
  zoom: number;
  /** 캔버스 크기 */
  w: number;
  h: number;
}

/** 타일 좌표 -> 화면 좌표 */
export function project(gx: number, gy: number, gz: number, cam: Cam): [number, number] {
  const sx = (gx - gy) * (TW / 2);
  const sy = (gx + gy) * (TH / 2) - gz * ZH;
  return [(sx - cam.x) * cam.zoom + cam.w / 2, (sy - cam.y) * cam.zoom + cam.h / 2];
}

/** 레티나 배율. 3배 이상은 성능만 먹고 체감이 없어서 2로 자른다 */
export function dpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/** 캔버스를 CSS 크기에 맞추고 지운 뒤 컨텍스트를 돌려준다 */
export function fit(canvas: HTMLCanvasElement, w: number, h: number): Ctx {
  const r = dpr();
  const pw = Math.max(1, Math.round(w * r));
  const ph = Math.max(1, Math.round(h * r));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}
