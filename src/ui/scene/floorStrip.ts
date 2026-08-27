/**
 * 사업 내부의 층(유닛) 한 줄 배경.
 *
 * 여기서는 그림을 그리지 않는다. 지층 색 띠(UI)와 스프라이트만 배치한다.
 * 작업자·설비·광석 그림은 public/art 의 파일에서 온다.
 */
import { alpha, shade } from '../../data/palette';
import { strataOf, workerCount } from '../../data/units';
import type { BusinessId } from '../../core/types';
import { hasSprite } from '../art/assets';
import type { Ctx } from './iso';

export interface StripArgs {
  ctx: Ctx;
  w: number;
  h: number;
  biz: BusinessId;
  color: string;
  index: number;
  level: number;
  unlocked: boolean;
  p: number;
  running: boolean;
  auto: boolean;
  idle: boolean;
  t: number;
  /** 스프라이트 그리기 (assets.drawImageAt 주입) */
  sprite?: (key: string, x: number, y: number, h: number) => boolean;
}

export function drawFloorStrip(a: StripArgs): void {
  const { ctx, w, h, biz, index, level, unlocked, p } = a;
  const strata = strataOf(index);
  const isMine = biz === 'mine';
  const base = isMine ? strata.rock : shade(a.color, 1.35);
  const dark = isMine ? strata.rockDark : shade(a.color, 1.12);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(base, 1.06));
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (!unlocked) {
    ctx.fillStyle = alpha('#2E3A4A', 0.5);
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // 바닥선
  const floorY = h - h * 0.16;
  ctx.fillStyle = shade(dark, 0.9);
  ctx.fillRect(0, floorY, w, h - floorY);

  // 작업 대상 영역 (색 구분만)
  ctx.fillStyle = shade(dark, 0.84);
  ctx.fillRect(w * 0.62, 0, w * 0.38, floorY);

  // 스프라이트가 있으면 작업자·설비를 배치한다
  const crew = workerCount(level);
  const put = a.sprite;
  if (put && hasSprite('props/worker')) {
    const startX = w * 0.16;
    const faceX = w * 0.58;
    for (let k = 0; k < crew; k++) {
      const q = a.idle ? 0 : (p + k / crew) % 1;
      const x = a.idle
        ? startX + k * (h * 0.22)
        : q < 0.32
          ? startX + (faceX - startX) * (q / 0.32)
          : q < 0.68
            ? faceX
            : faceX - (faceX - startX) * ((q - 0.68) / 0.32);
      put('props/worker', x, floorY, h * 0.5);
    }
  } else {
    // 아트가 아직 없을 때: 인원 수만 점으로 표시 (그림 아님)
    ctx.fillStyle = alpha('#2E3A4A', 0.5);
    for (let k = 0; k < crew; k++) {
      ctx.beginPath();
      ctx.arc(w * 0.18 + k * h * 0.16, floorY - h * 0.12, h * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (a.idle) {
    ctx.fillStyle = alpha('#2E3A4A', 0.28);
    ctx.fillRect(0, 0, w, h);
  }
}
