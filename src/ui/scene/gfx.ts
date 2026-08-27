/**
 * 미니게임용 캔버스 유틸.
 *
 * 도시 화면의 그림은 전부 public/art 의 스프라이트에서 온다. 여기서 코드로 그리는 건
 * **미니게임 안쪽뿐**이다 — 추상 미니게임이라 스프라이트를 쓰지 않는다.
 */

export interface Ctx2D extends CanvasRenderingContext2D {}

export function fitCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): Ctx2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}

export function rr(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function fillRR(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, color: string): void {
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}

export interface PersonOpts {
  /** 걷는 위상 (0~1). 다리/팔 스윙 */
  phase?: number;
  facing?: 1 | -1;
  body?: string;
  head?: string;
  /** 무언가를 들고 있음 */
  carry?: string | null;
  /** 곡괭이질 등 작업 스윙 (0~1) */
  work?: number | null;
}

/** 사람 한 명. h = 전체 키(px). 10~26px 사이에서 읽히도록 그린다. */
export function person(ctx: Ctx2D, x: number, y: number, h: number, o: PersonOpts = {}): void {
  const facing = o.facing ?? 1;
  const phase = o.phase ?? 0;
  const body = o.body ?? '#e9c46a';
  const head = o.head ?? '#f2d3a8';
  const headR = h * 0.18;
  const bodyH = h * 0.42;
  const legH = h * 0.3;
  const cx = x;
  const headY = y - h + headR;
  const bodyY = headY + headR;

  // 다리
  const swing = Math.sin(phase * Math.PI * 2) * (h * 0.16);
  ctx.strokeStyle = '#2b3a55';
  ctx.lineWidth = Math.max(1.6, h * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, bodyY + bodyH);
  ctx.lineTo(cx + swing, bodyY + bodyH + legH);
  ctx.moveTo(cx, bodyY + bodyH);
  ctx.lineTo(cx - swing, bodyY + bodyH + legH);
  ctx.stroke();

  // 몸통
  fillRR(ctx, cx - h * 0.13, bodyY, h * 0.26, bodyH, h * 0.09, body);

  // 팔 / 작업
  ctx.strokeStyle = body;
  ctx.lineWidth = Math.max(1.4, h * 0.075);
  ctx.beginPath();
  if (o.work != null) {
    const a = -0.9 + Math.sin(o.work * Math.PI * 2) * 1.1;
    const ax = cx + Math.cos(a) * h * 0.34 * facing;
    const ay = bodyY + h * 0.08 + Math.sin(a) * h * 0.34;
    ctx.moveTo(cx, bodyY + h * 0.08);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    // 도구
    ctx.strokeStyle = '#9aa6bd';
    ctx.lineWidth = Math.max(1.4, h * 0.07);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + h * 0.16 * facing, ay - h * 0.1);
    ctx.stroke();
  } else {
    const s = Math.sin(phase * Math.PI * 2 + Math.PI) * (h * 0.12);
    ctx.moveTo(cx, bodyY + h * 0.08);
    ctx.lineTo(cx + s + h * 0.1 * facing, bodyY + h * 0.26);
    ctx.stroke();
  }

  // 머리
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // 들고 있는 것
  if (o.carry) {
    ctx.fillStyle = o.carry;
    const s = h * 0.24;
    fillRR(ctx, cx + h * 0.14 * facing - s / 2, bodyY + h * 0.12, s, s * 0.8, s * 0.2, o.carry);
  }
}

/** 헬멧 쓴 광부 */
export function vGradient(ctx: Ctx2D, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}
