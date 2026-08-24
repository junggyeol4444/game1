/**
 * 한 방짜리 연출 두 가지 (아트 문서 6장, 9장).
 * 스프라이트가 아니라 캔버스 도형이다 — 순간 이펙트라 에셋을 쓰지 않는다.
 */
import { alpha } from '../../data/palette';
import type { Ctx } from './iso';

/** 마일스톤 원형 확산 (아트 9장). age 0~1 */
export function milestoneRing(ctx: Ctx, cx: number, cy: number, maxR: number, age: number, color: string): void {
  if (age <= 0 || age >= 1) return;
  const ease = 1 - Math.pow(1 - age, 3);
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const a = Math.max(0, age - i * 0.18);
    if (a <= 0 || a >= 1) continue;
    const e = 1 - Math.pow(1 - a, 3);
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * e, 0, Math.PI * 2);
    ctx.strokeStyle = alpha(color, (1 - a) * 0.75);
    ctx.lineWidth = Math.max(1.5, 5 * (1 - a));
    ctx.stroke();
  }
  // 가운데 번쩍
  ctx.globalAlpha = Math.max(0, 1 - ease * 2);
  ctx.fillStyle = alpha('#FFFFFF', 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 건물 교체 먼지 (아트 6장, 0.8초).
 * 옛 건물이 사라지고 새 건물이 서는 그 순간을 가린다.
 */
export function dustPuff(ctx: Ctx, cx: number, cy: number, w: number, age: number): void {
  if (age <= 0 || age >= 1) return;
  const puffs = 9;
  ctx.save();
  for (let i = 0; i < puffs; i++) {
    // 결정적 난수 — 같은 연출이 매 프레임 같은 자리에 있어야 한다
    const seed = i * 2654435761;
    const rx = (((seed >>> 8) % 1000) / 1000 - 0.5) * 1.6;
    const ry = ((seed >>> 17) % 1000) / 1000;
    const delay = ((seed >>> 5) % 300) / 1000;
    const a = (age - delay) / (1 - delay);
    if (a <= 0) continue;
    const r = w * (0.10 + 0.26 * a) * (0.7 + ry * 0.6);
    const x = cx + rx * w * 0.5 * (0.4 + a);
    const y = cy - w * 0.22 * a - ry * w * 0.18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = alpha(i % 3 === 0 ? '#C9BBA1' : '#DCD2BE', (1 - a) * 0.72);
    ctx.fill();
  }
  ctx.restore();
}
