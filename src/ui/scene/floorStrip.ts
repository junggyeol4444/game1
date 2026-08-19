/**
 * 사업 내부 화면의 층(유닛) 한 줄.
 * 도시 지도는 아이소메트릭, 내부는 단면(側斷面) — 기획서 광산 상세 2장 배치.
 * 팔레트와 저폴리 톤은 동일하게 유지한다.
 */
import { PAL, alpha, shade } from '../../data/palette';
import { strataOf, workerCount } from '../../data/units';
import type { BusinessId } from '../../core/types';
import { roundRect, type Ctx } from './iso';

export interface StripArgs {
  ctx: Ctx;
  w: number;
  h: number;
  biz: BusinessId;
  color: string;
  index: number;
  level: number;
  unlocked: boolean;
  /** 사이클 진행 0~1 */
  p: number;
  running: boolean;
  auto: boolean;
  /** 인구 부족으로 멈춤 */
  idle: boolean;
  t: number;
}

function flatPerson(ctx: Ctx, x: number, y: number, hgt: number, color: string, phase: number, working: boolean): void {
  const s = hgt / 26;
  const bob = Math.sin(phase * Math.PI * 2) * 1.6;
  ctx.fillStyle = alpha(PAL.shadow, 0.18);
  ctx.beginPath();
  ctx.ellipse(x, y, 7 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5A6472';
  ctx.fillRect(x - 4.2 * s, y - 9 * s, 3 * s, 9 * s);
  ctx.fillRect(x + 1.2 * s, y - 9 * s, 3 * s, 9 * s);
  ctx.fillStyle = color;
  roundRect(ctx, x - 5.2 * s, y - 20 * s + bob, 10.4 * s, 11.5 * s, 3 * s);
  // 팔 / 도구
  ctx.strokeStyle = shade(color, 0.85);
  ctx.lineWidth = 2.6 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const swing = working ? Math.sin(phase * Math.PI * 4) * 0.9 - 0.4 : 0.2;
  ctx.moveTo(x + 4 * s, y - 16 * s + bob);
  ctx.lineTo(x + 4 * s + Math.cos(swing) * 9 * s, y - 16 * s + bob + Math.sin(swing) * 9 * s);
  ctx.stroke();
  if (working) {
    ctx.strokeStyle = '#9AA6B4';
    ctx.lineWidth = 2.4 * s;
    const ex = x + 4 * s + Math.cos(swing) * 9 * s;
    const ey = y - 16 * s + bob + Math.sin(swing) * 9 * s;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + 7 * s, ey - 4 * s);
    ctx.stroke();
  }
  ctx.fillStyle = '#F5D3B0';
  ctx.beginPath();
  ctx.arc(x, y - 24.5 * s + bob, 5.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.accent;
  ctx.beginPath();
  ctx.arc(x, y - 25.5 * s + bob, 6 * s, Math.PI, Math.PI * 2);
  ctx.fill();
}

export function drawFloorStrip(a: StripArgs): void {
  const { ctx, w, h, biz, index, level, unlocked, p, t } = a;
  const strata = strataOf(index);
  const isMine = biz === 'mine';
  const bg = isMine ? strata.rock : shade(a.color, 1.35);
  const bgDark = isMine ? strata.rockDark : shade(a.color, 1.1);

  // 배경
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(bg, 1.06));
  g.addColorStop(1, bgDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (!unlocked) {
    ctx.fillStyle = alpha('#2E3A4A', 0.55);
    ctx.fillRect(0, 0, w, h);
    // 미개발 암반 질감
    ctx.fillStyle = alpha('#FFFFFF', 0.07);
    for (let i = 0; i < 14; i++) {
      const x = ((i * 97) % 100) / 100 * w;
      const y = ((i * 53) % 100) / 100 * h;
      ctx.beginPath();
      ctx.ellipse(x, y, 16 + (i % 4) * 6, 7 + (i % 3) * 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const floorY = h - h * 0.16;
  // 바닥
  ctx.fillStyle = shade(bgDark, 0.88);
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = alpha('#FFFFFF', 0.18);
  ctx.fillRect(0, floorY, w, 2);

  // 우측 막장 / 작업 대상
  const faceX = w * 0.6;
  ctx.fillStyle = shade(bgDark, 0.82);
  ctx.fillRect(faceX, 0, w - faceX, floorY);
  // 광석 / 산출물
  const oreCol = isMine ? strata.ore : PAL.accent;
  for (let i = 0; i < 5; i++) {
    const ox = faceX + 14 + ((i * 37) % Math.max(1, w - faceX - 26));
    const oy = 14 + ((i * 61) % Math.max(1, floorY - 26));
    ctx.fillStyle = oreCol;
    ctx.beginPath();
    ctx.ellipse(ox, oy, 6, 4.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha('#FFFFFF', 0.5);
    ctx.beginPath();
    ctx.ellipse(ox - 1.6, oy - 1.4, 2, 1.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 좌측 적재함
  const cartW = w * 0.13;
  const cartH = h * 0.3;
  const cartX = 10;
  const cartY = floorY - cartH;
  ctx.fillStyle = '#8B6F47';
  roundRect(ctx, cartX, cartY, cartW, cartH, 4);
  ctx.fillStyle = oreCol;
  const fill = Math.max(0, Math.min(1, p)) * (cartH - 8);
  ctx.fillRect(cartX + 4, cartY + cartH - 4 - fill, cartW - 8, fill);
  ctx.fillStyle = '#4A3B2A';
  ctx.beginPath();
  ctx.arc(cartX + cartW * 0.26, cartY + cartH + 3, 3.2, 0, Math.PI * 2);
  ctx.arc(cartX + cartW * 0.74, cartY + cartH + 3, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // 작업자
  const crew = workerCount(level);
  const startX = cartX + cartW + 16;
  for (let k = 0; k < crew; k++) {
    const q = a.idle ? 0 : (p + k / crew) % 1;
    let x: number;
    let working = false;
    if (a.idle) {
      x = startX + k * 22;
    } else if (q < 0.32) {
      x = startX + (faceX - 20 - startX) * (q / 0.32);
    } else if (q < 0.68) {
      x = faceX - 20;
      working = true;
    } else {
      x = faceX - 20 - (faceX - 20 - startX) * ((q - 0.68) / 0.32);
    }
    flatPerson(ctx, x, floorY + 2, h * 0.42, a.idle ? '#9AA6B4' : '#E9A23B', t * 1.6 + k, working);
  }

  // 정타 반짝임
  if (!a.idle && p > 0.34 && p < 0.66 && Math.sin(t * 14) > 0.6) {
    ctx.fillStyle = alpha(PAL.accent, 0.85);
    ctx.beginPath();
    ctx.arc(faceX - 6, floorY - h * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (a.idle) {
    ctx.fillStyle = alpha('#2E3A4A', 0.3);
    ctx.fillRect(0, 0, w, h);
  }
}
