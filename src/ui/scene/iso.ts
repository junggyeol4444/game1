/**
 * 고정 아이소메트릭 (직교 투영) 저폴리 렌더러.
 * 회전 없음 · 2:1 다이아몬드 타일 · 텍스처 없음 · 면마다 명도만 다름.
 */
import { FACE, PAL, alpha, shade } from '../../data/palette';

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

export function project(gx: number, gy: number, gz: number, cam: Cam): [number, number] {
  const sx = (gx - gy) * (TW / 2);
  const sy = (gx + gy) * (TH / 2) - gz * ZH;
  return [(sx - cam.x) * cam.zoom + cam.w / 2, (sy - cam.y) * cam.zoom + cam.h / 2];
}

/** 화면 좌표 -> 타일 좌표 (z=0 평면) */
export function unproject(px: number, py: number, cam: Cam): [number, number] {
  const wx = (px - cam.w / 2) / cam.zoom + cam.x;
  const wy = (py - cam.h / 2) / cam.zoom + cam.y;
  const gx = wy / TH + wx / TW;
  const gy = wy / TH - wx / TW;
  return [gx, gy];
}

function poly(ctx: Ctx, pts: [number, number][], fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** 바닥 타일 1칸 */
export function tile(ctx: Ctx, cam: Cam, gx: number, gy: number, color: string, z = 0): void {
  poly(
    ctx,
    [
      project(gx, gy, z, cam),
      project(gx + 1, gy, z, cam),
      project(gx + 1, gy + 1, z, cam),
      project(gx, gy + 1, z, cam),
    ],
    color,
  );
}

/** 임의 크기 바닥 사각형 */
export function ground(ctx: Ctx, cam: Cam, gx: number, gy: number, w: number, d: number, color: string, z = 0): void {
  poly(
    ctx,
    [
      project(gx, gy, z, cam),
      project(gx + w, gy, z, cam),
      project(gx + w, gy + d, z, cam),
      project(gx, gy + d, z, cam),
    ],
    color,
  );
}

/** 저폴리 박스. base = 바닥 z, h = 높이 */
export function box(
  ctx: Ctx,
  cam: Cam,
  gx: number,
  gy: number,
  w: number,
  d: number,
  h: number,
  color: string,
  base = 0,
): void {
  const top = base + h;
  // 우측면 (x+)
  poly(
    ctx,
    [
      project(gx + w, gy, top, cam),
      project(gx + w, gy + d, top, cam),
      project(gx + w, gy + d, base, cam),
      project(gx + w, gy, base, cam),
    ],
    shade(color, FACE.right),
  );
  // 전면 (y+)
  poly(
    ctx,
    [
      project(gx, gy + d, top, cam),
      project(gx + w, gy + d, top, cam),
      project(gx + w, gy + d, base, cam),
      project(gx, gy + d, base, cam),
    ],
    shade(color, FACE.left),
  );
  // 윗면
  poly(
    ctx,
    [
      project(gx, gy, top, cam),
      project(gx + w, gy, top, cam),
      project(gx + w, gy + d, top, cam),
      project(gx, gy + d, top, cam),
    ],
    shade(color, FACE.top),
  );
}

/** 박공 지붕 (y 방향 용마루) */
export function gableRoof(
  ctx: Ctx,
  cam: Cam,
  gx: number,
  gy: number,
  w: number,
  d: number,
  base: number,
  rise: number,
  color: string,
): void {
  const midX = gx + w / 2;
  const top = base + rise;
  // 오른쪽 경사면
  poly(
    ctx,
    [
      project(midX, gy, top, cam),
      project(gx + w, gy, base, cam),
      project(gx + w, gy + d, base, cam),
      project(midX, gy + d, top, cam),
    ],
    shade(color, FACE.right),
  );
  // 왼쪽 경사면
  poly(
    ctx,
    [
      project(midX, gy, top, cam),
      project(gx, gy, base, cam),
      project(gx, gy + d, base, cam),
      project(midX, gy + d, top, cam),
    ],
    shade(color, FACE.top),
  );
  // 앞 박공
  poly(
    ctx,
    [
      project(gx, gy + d, base, cam),
      project(midX, gy + d, top, cam),
      project(gx + w, gy + d, base, cam),
    ],
    shade(color, FACE.left),
  );
}

/** 원뿔/피라미드 지붕 */
export function pyramidRoof(
  ctx: Ctx,
  cam: Cam,
  gx: number,
  gy: number,
  w: number,
  d: number,
  base: number,
  rise: number,
  color: string,
): void {
  const apex = project(gx + w / 2, gy + d / 2, base + rise, cam);
  const c = [
    project(gx, gy, base, cam),
    project(gx + w, gy, base, cam),
    project(gx + w, gy + d, base, cam),
    project(gx, gy + d, base, cam),
  ];
  poly(ctx, [c[1], c[2], apex], shade(color, FACE.right));
  poly(ctx, [c[2], c[3], apex], shade(color, FACE.left));
  poly(ctx, [c[0], c[1], apex], shade(color, FACE.top));
}

/** 원기둥 (굴뚝·탱크). 세로 사각 + 윗면 타원 */
export function cylinder(
  ctx: Ctx,
  cam: Cam,
  gx: number,
  gy: number,
  r: number,
  h: number,
  color: string,
  base = 0,
): void {
  const [bx, by] = project(gx, gy, base, cam);
  const [tx, ty] = project(gx, gy, base + h, cam);
  const rw = r * TW * cam.zoom;
  const rh = r * TH * cam.zoom;
  ctx.fillStyle = shade(color, FACE.left);
  ctx.beginPath();
  ctx.moveTo(bx - rw, by);
  ctx.lineTo(tx - rw, ty);
  ctx.lineTo(tx + rw, ty);
  ctx.lineTo(bx + rw, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, FACE.top);
  ctx.beginPath();
  ctx.ellipse(tx, ty, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 지면 그림자 (검정 아님 — 푸른빛) */
export function shadow(ctx: Ctx, cam: Cam, gx: number, gy: number, w: number, d: number): void {
  const [cx, cy] = project(gx + w / 2, gy + d / 2, 0, cam);
  ctx.fillStyle = alpha(PAL.shadow, 0.22);
  ctx.beginPath();
  ctx.ellipse(cx, cy, ((w + d) / 2) * (TW / 2) * cam.zoom * 0.92, ((w + d) / 2) * (TH / 2) * cam.zoom * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 창문 — 벽면에 붙는 작은 사각 (전면 y+ 기준) */
export function windowsFront(
  ctx: Ctx,
  cam: Cam,
  gx: number,
  gy: number,
  w: number,
  base: number,
  h: number,
  cols: number,
  rows: number,
  on: (r: number, c: number) => boolean,
): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = gx + ((c + 0.28) * w) / cols;
      const x1 = gx + ((c + 0.72) * w) / cols;
      const z0 = base + ((r + 0.3) * h) / rows;
      const z1 = base + ((r + 0.75) * h) / rows;
      poly(
        ctx,
        [
          project(x0, gy, z1, cam),
          project(x1, gy, z1, cam),
          project(x1, gy, z0, cam),
          project(x0, gy, z0, cam),
        ],
        on(r, c) ? PAL.accent : shade('#BFD8EA', 0.9),
      );
    }
  }
}

/** 2.5등신 캐릭터. 이목구비 없음 */
export function person(
  ctx: Ctx,
  cam: Cam,
  gx: number,
  gy: number,
  color: string,
  z = 0,
  scale = 1,
  phase = 0,
): void {
  const [x, y] = project(gx, gy, z, cam);
  const s = cam.zoom * scale;
  const bob = Math.sin(phase * Math.PI * 2) * 1.4 * s;
  // 그림자
  ctx.fillStyle = alpha(PAL.shadow, 0.2);
  ctx.beginPath();
  ctx.ellipse(x, y, 7 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // 다리
  ctx.fillStyle = shade('#4A5568', 0.95);
  ctx.fillRect(x - 4.4 * s, y - 9 * s, 3.2 * s, 9 * s);
  ctx.fillRect(x + 1.2 * s, y - 9 * s, 3.2 * s, 9 * s);
  // 몸통
  ctx.fillStyle = color;
  roundRect(ctx, x - 5.4 * s, y - 20 * s + bob, 10.8 * s, 12 * s, 3 * s);
  // 팔
  ctx.fillStyle = shade(color, 0.86);
  ctx.fillRect(x - 7.4 * s, y - 18 * s + bob, 2.4 * s, 8 * s);
  ctx.fillRect(x + 5 * s, y - 18 * s + bob, 2.4 * s, 8 * s);
  // 머리 (2.5등신 = 크게)
  ctx.fillStyle = '#F5D3B0';
  ctx.beginPath();
  ctx.arc(x, y - 25 * s + bob, 6.2 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** 안전모 쓴 작업자 */
export function worker(
  ctx: Ctx,
  cam: Cam,
  gx: number,
  gy: number,
  helmet: string,
  z = 0,
  scale = 1,
  phase = 0,
): void {
  person(ctx, cam, gx, gy, '#E9A23B', z, scale, phase);
  const [x, y] = project(gx, gy, z, cam);
  const s = cam.zoom * scale;
  const bob = Math.sin(phase * Math.PI * 2) * 1.4 * s;
  ctx.fillStyle = helmet;
  ctx.beginPath();
  ctx.arc(x, y - 26 * s + bob, 6.6 * s, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 7.4 * s, y - 26.4 * s + bob, 14.8 * s, 1.8 * s);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  ctx.fill();
}

/** 차량 (저폴리 박스 2개) */
export function car(ctx: Ctx, cam: Cam, gx: number, gy: number, color: string, horizontal: boolean): void {
  const w = horizontal ? 0.62 : 0.3;
  const d = horizontal ? 0.3 : 0.62;
  shadow(ctx, cam, gx - w / 2, gy - d / 2, w, d);
  box(ctx, cam, gx - w / 2, gy - d / 2, w, d, 0.2, color);
  box(ctx, cam, gx - w / 4, gy - d / 4, w / 2, d / 2, 0.34, shade(color, 1.06));
}

export function dpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

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
