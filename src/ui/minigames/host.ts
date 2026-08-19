import { CONFIG } from '../../data/config';
import type { BusinessId } from '../../core/types';
import { fitCanvas } from '../scene/gfx';
import { h } from '../dom';

export interface MgCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 시작 후 경과 초 */
  t: number;
  dt: number;
  /** 남은 초 */
  remain: number;
}

export interface MinigameInstance {
  draw(c: MgCtx): void;
  down?(x: number, y: number): void;
  move?(x: number, y: number): void;
  up?(x: number, y: number): void;
  /** 현재 점수 */
  score: number;
  /** 만점 기준 (성적 계산용) */
  target: number;
  /** 상단에 띄울 짧은 상태 문구 */
  status?: string;
}

export interface MinigameDef {
  id: BusinessId;
  title: string;
  howto: string;
  duration?: number;
  create(w: number, h: number): MinigameInstance;
}

export type Grade = 'F' | 'C' | 'B' | 'A' | 'S';

export interface MinigameResult {
  score: number;
  target: number;
  ratio: number;
  grade: Grade;
  /** 성적 배율 0.5 ~ 3.0 */
  mult: number;
  /** 보상 환산초 */
  rewardSeconds: number;
}

function gradeOf(ratio: number): Grade {
  if (ratio >= 0.9) return 'S';
  if (ratio >= 0.7) return 'A';
  if (ratio >= 0.45) return 'B';
  if (ratio >= 0.2) return 'C';
  return 'F';
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 미니게임 1판. 결과를 돌려준다 (보상 적용은 Game 쪽) */
export function playMinigame(def: MinigameDef): Promise<MinigameResult | null> {
  return new Promise((resolve) => {
    const C = CONFIG.minigame;
    const duration = def.duration ?? C.durationSeconds;

    const canvas = h('canvas', { class: 'mg-canvas' });
    const scoreEl = h('div', { class: 'mg-score' }, '0');
    const timeEl = h('div', { class: 'mg-time' }, `${duration}`);
    const statusEl = h('div', { class: 'mg-status' }, '');
    const howto = h('div', { class: 'mg-howto' }, def.howto);
    const bigEl = h('div', { class: 'mg-big' }, '');
    const stage = h('div', { class: 'mg-stage' }, canvas, bigEl);

    const overlay = h(
      'div',
      { class: 'mg' },
      h(
        'div',
        { class: 'mg-top' },
        h('div', { class: 'mg-title' }, def.title),
        h('div', { class: 'grow' }),
        h('div', { class: 'mg-chip' }, '⏱ ', timeEl),
        h('div', { class: 'mg-chip gold' }, '⭐ ', scoreEl),
      ),
      statusEl,
      stage,
      howto,
    );
    document.body.appendChild(overlay);

    let inst: MinigameInstance | null = null;
    let phase: 'count' | 'play' | 'done' = 'count';
    let countdown = 3;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;

    const rect = () => canvas.getBoundingClientRect();
    const pos = (e: PointerEvent): [number, number] => {
      const r = rect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      if (phase !== 'play' || !inst?.down) return;
      const [x, y] = pos(e);
      inst.down(x, y);
    };
    const onMove = (e: PointerEvent) => {
      if (phase !== 'play' || !inst?.move) return;
      const [x, y] = pos(e);
      inst.move(x, y);
    };
    const onUp = (e: PointerEvent) => {
      if (phase !== 'play' || !inst?.up) return;
      const [x, y] = pos(e);
      inst.up(x, y);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    function finish(): void {
      phase = 'done';
      cancelAnimationFrame(raf);
      const score = Math.max(0, Math.round(inst?.score ?? 0));
      const target = Math.max(1, inst?.target ?? 1);
      const ratio = Math.min(1.2, score / target);
      const grade = gradeOf(ratio);
      const result: MinigameResult = {
        score,
        target,
        ratio,
        grade,
        mult: lerp(C.gradeMultMin, C.gradeMultMax, Math.min(1, ratio)),
        rewardSeconds: lerp(C.rewardSecondsMin, C.rewardSecondsMax, Math.min(1, ratio)),
      };
      overlay.remove();
      resolve(result);
    }

    function frame(now: number): void {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = stage.clientWidth;
      const hh = stage.clientHeight;
      if (w > 0 && hh > 0) {
        const ctx = fitCanvas(canvas, w, hh);
        if (!inst) inst = def.create(w, hh);
        if (phase === 'count') {
          countdown -= dt;
          inst.draw({ ctx, w, h: hh, t: 0, dt: 0, remain: duration });
          bigEl.textContent = countdown > 0 ? String(Math.ceil(countdown)) : '시작!';
          if (countdown < -0.4) {
            phase = 'play';
            bigEl.textContent = '';
          }
        } else if (phase === 'play') {
          elapsed += dt;
          inst.draw({ ctx, w, h: hh, t: elapsed, dt, remain: Math.max(0, duration - elapsed) });
          scoreEl.textContent = String(Math.round(inst.score));
          timeEl.textContent = String(Math.ceil(Math.max(0, duration - elapsed)));
          statusEl.textContent = inst.status ?? '';
          if (elapsed >= duration) return finish();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}
