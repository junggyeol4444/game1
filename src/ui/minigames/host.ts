import { CONFIG } from '../../data/config';
import { setComboStep, sfx } from '../../core/audio';
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
  /** 성공률 0~1 (없으면 score/target 으로 계산) */
  successRate?: () => number;
  /** 미니게임으로만 얻는 특산물 개수 */
  bonusItems?: number;
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

/**
 * 미니게임이 손맛을 요청하는 통로.
 * 판정할 때마다 게임이 이걸 부르면 호스트가 소리 · 튀는 글자 · 화면 흔들림을 붙인다.
 * 게임 쪽은 연출을 몰라도 된다.
 */
export interface MinigameFx {
  /**
   * @param kind  perfect = 정타, good = 근접, miss = 빗나감
   * @param label 화면에 튀울 문구 (없으면 기본값)
   * @param combo 지금 콤보 수. 넘기면 콤보음이 반음씩 올라간다
   */
  hit(kind: 'perfect' | 'good' | 'miss', label?: string, combo?: number): void;
}

export interface MinigameDef {
  id: BusinessId;
  title: string;
  howto: string;
  duration?: number;
  create(w: number, h: number, fx: MinigameFx): MinigameInstance;
}

export type Grade = 'F' | 'C' | 'B' | 'A' | 'S';

export interface MinigameResult {
  score: number;
  target: number;
  /** 성공률 0~1 */
  rate: number;
  grade: Grade;
  /** 성적 배율 = 0.5 + 성공률 x 2.5 */
  mult: number;
  /** 미니게임 특산물 획득 수 */
  bonusItems: number;
  /** 지급된 현금. Game 이 보상을 계산한 뒤 채운다 */
  reward?: number;
  /** 특산물 안내 문구. Game 이 채운다 */
  spoilText?: string;
}

function gradeOf(ratio: number): Grade {
  if (ratio >= 0.9) return 'S';
  if (ratio >= 0.7) return 'A';
  if (ratio >= 0.45) return 'B';
  if (ratio >= 0.2) return 'C';
  return 'F';
}


/** 미니게임 1판. 결과를 돌려준다 (보상 적용은 Game 쪽) */
export function playMinigame(def: MinigameDef, opts: { reducedMotion?: boolean } = {}): Promise<MinigameResult | null> {
  return new Promise((resolve) => {
    const reducedMotion = Boolean(opts.reducedMotion);
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

    // 판정 문구는 캔버스 위에 떠서 올라갔다 사라진다
    const pops: { text: string; kind: string; born: number }[] = [];
    const fx: MinigameFx = {
      hit(kind, label, combo) {
        const text = label ?? (kind === 'perfect' ? '정타!' : kind === 'good' ? '근접' : '빗나감');
        pops.push({ text, kind, born: performance.now() / 1000 });
        if (pops.length > 4) pops.shift();
        if (kind === 'perfect') {
          if (combo && combo > 1) {
            setComboStep(combo - 1);
            sfx('mgCombo');
          } else {
            setComboStep(0);
          }
          sfx('mgPerfect');
          shakeStage('tap');
        } else if (kind === 'good') {
          sfx('mgGood');
        } else {
          setComboStep(0);
          sfx('mgMiss');
          shakeStage('hit');
        }
      },
    };

    function shakeStage(level: 'tap' | 'hit'): void {
      if (reducedMotion) return;
      const cls = level === 'tap' ? 'sh-tap' : 'sh-hit';
      stage.classList.remove(cls);
      void stage.offsetWidth;
      stage.classList.add(cls);
      window.setTimeout(() => stage.classList.remove(cls), level === 'tap' ? 90 : 220);
    }

    /** 판정 문구를 캔버스 위에 그린다 (0.7초 동안 떠오르며 사라진다) */
    function drawPops(ctx: CanvasRenderingContext2D, w: number, hh: number, nowSec: number): void {
      for (let i = pops.length - 1; i >= 0; i--) {
        const age = (nowSec - pops[i].born) / 0.7;
        if (age >= 1) {
          pops.splice(i, 1);
          continue;
        }
        const p = pops[i];
        ctx.save();
        ctx.globalAlpha = 1 - age * age;
        ctx.textAlign = 'center';
        const size = (p.kind === 'perfect' ? 30 : 22) * (1 + (1 - Math.pow(1 - age, 3)) * 0.25);
        ctx.font = `900 ${size}px system-ui, sans-serif`;
        ctx.fillStyle = p.kind === 'perfect' ? '#FFC845' : p.kind === 'good' ? '#8FD3A8' : '#E85D4A';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(20,28,40,0.55)';
        const y = hh * 0.42 - age * hh * 0.16 - i * 4;
        ctx.strokeText(p.text, w * 0.5, y);
        ctx.fillText(p.text, w * 0.5, y);
        ctx.restore();
      }
    }

    let inst: MinigameInstance | null = null;
    let phase: 'count' | 'play' | 'done' = 'count';
    let countdown = 3;
    let lastTick = 4;
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
      const rate = Math.max(0, Math.min(1, inst?.successRate ? inst.successRate() : score / target));
      sfx('mgEnd');
      setComboStep(0);
      const result: MinigameResult = {
        score,
        target,
        rate,
        grade: gradeOf(rate),
        mult: C.gradeBase + rate * C.gradeSlope,
        bonusItems: inst?.bonusItems ?? 0,
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
        if (!inst) inst = def.create(w, hh, fx);
        if (phase === 'count') {
          countdown -= dt;
          inst.draw({ ctx, w, h: hh, t: 0, dt: 0, remain: duration });
          const n = Math.ceil(countdown);
          if (countdown > 0 && n < lastTick) {
            lastTick = n;
            sfx('mgTick');
          }
          bigEl.textContent = countdown > 0 ? String(n) : '시작!';
          if (countdown <= 0 && lastTick > 0) {
            lastTick = 0;
            sfx('mgStart');
          }
          if (countdown < -0.4) {
            phase = 'play';
            bigEl.textContent = '';
            lastTick = 6; // 종료 초읽기용으로 다시 쓴다
          }
        } else if (phase === 'play') {
          elapsed += dt;
          inst.draw({ ctx, w, h: hh, t: elapsed, dt, remain: Math.max(0, duration - elapsed) });
          drawPops(ctx, w, hh, now / 1000);
          // 남은 5초부터 초읽기
          const left = Math.ceil(Math.max(0, duration - elapsed));
          if (left <= 5 && left < lastTick) {
            lastTick = left;
            sfx('mgTick');
          }
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
