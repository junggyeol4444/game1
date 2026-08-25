/**
 * 미니게임 5종을 실제로 굴린다.
 * 브라우저 스모크는 광산 1종만 30초 돌린다 — 나머지 4종은 한 번도 실행된 적이 없었다.
 * 여기서는 캔버스를 흉내 내고 30초치 프레임 + 입력을 먹인다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MINIGAMES, MINIGAME_SPOILS } from '../src/ui/minigames/games';
import type { MinigameFx } from '../src/ui/minigames/host';

/** 게임이 부르는 캔버스 API 를 전부 삼키는 가짜 컨텍스트 */
function stubCtx() {
  const gradient = { addColorStop() {} };
  const noop = () => undefined;
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    save: noop,
    restore: noop,
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k as string];
      // 나머지는 전부 no-op 함수 또는 쓰기 가능한 속성
      return typeof k === 'string' && /^[a-z]/.test(k) ? noop : undefined;
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const W = 390;
const H = 560;

function play(id: string, tapEvery: number) {
  const def = MINIGAMES[id];
  assert.ok(def, `${id} 미니게임이 없다`);
  const hits: string[] = [];
  const fx: MinigameFx = { hit: (kind) => hits.push(kind) };
  const inst = def.create(W, H, fx);
  const ctx = stubCtx();
  const dt = 1 / 30;
  const duration = def.duration ?? 30;
  let taps = 0;

  for (let t = 0; t < duration; t += dt) {
    inst.draw({ ctx, w: W, h: H, t, dt, remain: duration - t });
    if (Math.floor(t / tapEvery) > taps) {
      taps += 1;
      const x = W * (0.2 + ((taps * 37) % 60) / 100);
      const y = H * (0.3 + ((taps * 53) % 50) / 100);
      inst.down?.(x, y);
      inst.move?.(x + 4, y + 4);
      inst.up?.(x + 4, y + 4);
    }
    assert.ok(Number.isFinite(inst.score), `${id}: 점수가 ${inst.score} 다 (t=${t.toFixed(1)})`);
  }
  const rate = inst.successRate ? inst.successRate() : inst.score / inst.target;
  return { inst, hits, rate };
}

for (const id of ['mine', 'factory', 'fishery', 'park', 'corp']) {
  test(`${id}: 30초 완주하고 점수가 유한하다`, () => {
    const { inst, rate } = play(id, 0.4);
    assert.ok(Number.isFinite(inst.score), `점수 ${inst.score}`);
    assert.ok(inst.score >= 0, `점수가 음수다: ${inst.score}`);
    assert.ok(inst.target > 0, '만점 기준이 0 이하다');
    assert.ok(Number.isFinite(rate) && rate >= 0 && rate <= 1, `성공률이 ${rate} 다`);
    assert.ok(Number.isFinite(inst.bonusItems ?? 0), '특산물 개수가 유한하지 않다');
  });

  test(`${id}: 아무것도 안 눌러도 안 죽는다`, () => {
    const def = MINIGAMES[id];
    const inst = def.create(W, H, { hit: () => {} });
    const ctx = stubCtx();
    for (let t = 0; t < 30; t += 1 / 30) {
      inst.draw({ ctx, w: W, h: H, t, dt: 1 / 30, remain: 30 - t });
    }
    assert.ok(Number.isFinite(inst.score));
    const rate = inst.successRate ? inst.successRate() : inst.score / inst.target;
    assert.ok(Number.isFinite(rate) && rate >= 0, `무입력 성공률이 ${rate} 다`);
  });
}

test('마구 눌러도 성공률이 1 을 안 넘는다', () => {
  for (const id of ['mine', 'factory', 'fishery', 'park', 'corp']) {
    const { rate } = play(id, 1 / 30); // 매 프레임 탭
    assert.ok(rate <= 1, `${id} 성공률 ${rate}`);
    assert.ok(rate >= 0, `${id} 성공률 ${rate}`);
  }
});

test('특산물 정의가 5종 다 있다', () => {
  for (const id of ['mine', 'factory', 'fishery', 'park', 'corp']) {
    const sp = MINIGAME_SPOILS[id];
    assert.ok(sp, `${id} 특산물 정의 없음`);
    assert.ok(sp.label && sp.icon, `${id} 라벨/아이콘 없음`);
    assert.ok(sp.counter || sp.list, `${id} 는 아무것도 안 준다`);
    if (sp.list) assert.ok(sp.names && sp.names.length > 0, `${id} 수집품 목록이 비었다`);
  }
});
