/**
 * 출석 · 미션 수령 · 엘리베이터 보석 비용.
 * 전부 Game 을 실제로 굴려서 확인한다.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const store = new MemStore();
(globalThis as unknown as { localStorage: MemStore }).localStorage = store;

const { Game } = await import('../src/core/game');
const { setTimeSource, deviceTime } = await import('../src/core/save');
const { CONFIG } = await import('../src/data/config');
const { HOIST_LEVELS } = await import('../src/data/units');
const { hoistCost, hoistGemCost, invalidateStats } = await import('../src/core/economy');
import type { AdProvider } from '../src/core/ads';

const ok: AdProvider = { name: 't', isReady: () => true, showRewarded: () => Promise.resolve('completed') };

let clock = Date.UTC(2030, 0, 10, 12, 0, 0);
beforeEach(() => {
  store.clear();
  clock = Date.UTC(2030, 0, 10, 12, 0, 0);
  setTimeSource({ now: () => clock });
});

const day = 86400 * 1000;

// ── 출석 ──
test('하루에 한 번만 받는다', () => {
  const g = new Game(ok);
  assert.equal(g.claimAttendance(), true);
  assert.equal(g.claimAttendance(), false, '같은 날 두 번 받았다');
  assert.equal(g.claimAttendance(), false);
  setTimeSource(deviceTime);
});

test('날이 바뀌면 다시 받을 수 있고 연속이 오른다', () => {
  const g = new Game(ok);
  g.claimAttendance();
  const streak1 = g.state.attendance.streak;
  clock += day;
  g.refreshAttendance();
  assert.equal(g.state.attendance.claimedToday, false, '날이 바뀌었는데 안 풀렸다');
  assert.equal(g.claimAttendance(), true);
  assert.equal(g.state.attendance.streak, (streak1 + 1) % 7);
  setTimeSource(deviceTime);
});

test('7일을 채우면 처음으로 돌아간다', () => {
  const g = new Game(ok);
  const seen: number[] = [];
  for (let i = 0; i < 8; i++) {
    g.refreshAttendance();
    seen.push(g.state.attendance.streak);
    assert.equal(g.claimAttendance(), true, `${i + 1}일차 수령 실패`);
    clock += day;
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 0], `연속이 ${seen} 로 돌았다`);
  setTimeSource(deviceTime);
});

test('출석 보상 3종이 실제로 지급된다', () => {
  const g = new Game(ok);
  let gotCash = false;
  let gotLegacy = false;
  let gotBoost = false;
  for (let i = 0; i < 7; i++) {
    const r = CONFIG.attendance.rewards[i];
    const cashBefore = g.state.resources.cash;
    const bpBefore = g.state.resources.blueprint;
    g.refreshAttendance();
    assert.equal(g.claimAttendance(), true);
    if (r.type === 'cashSeconds') {
      assert.ok(g.state.resources.cash > cashBefore, `${i + 1}일차 자금이 안 늘었다`);
      gotCash = true;
    } else if (r.type === 'blueprint') {
      assert.ok(g.state.resources.blueprint > bpBefore, `${i + 1}일차 유산이 안 늘었다`);
      gotLegacy = true;
    } else {
      assert.ok(g.state.businesses.mine.boostUntil > clock, `${i + 1}일차 부스터가 안 붙었다`);
      gotBoost = true;
    }
    clock += day;
  }
  assert.ok(gotCash && gotLegacy && gotBoost, '3종이 다 안 나왔다');
  setTimeSource(deviceTime);
});

test('출석 자금 보상은 최소치가 보장된다 (수입 0인 신규 유저)', () => {
  const g = new Game(ok);
  const before = g.state.resources.cash;
  g.claimAttendance();
  assert.ok(g.state.resources.cash > before, '신규 유저가 0원을 받았다');
  setTimeSource(deviceTime);
});

// ── 엘리베이터 ──
test('보석은 3단계부터 필요하다', () => {
  const g = new Game(ok);
  const s = g.state;
  for (let lv = 1; lv <= 3; lv++) {
    s.businesses.mine.hoistLevel = lv;
    const gems = hoistGemCost(s, 'mine');
    if (lv <= 2) assert.equal(gems, 0, `${lv}단계에서 보석 ${gems} 를 요구한다`);
    else assert.ok(gems > 0, `${lv}단계인데 보석이 공짜다`);
  }
  setTimeSource(deviceTime);
});

test('보석이 모자라면 엘리베이터를 못 올린다', () => {
  const g = new Game(ok);
  const s = g.state;
  s.businesses.mine.hoistLevel = 4;
  s.resources.cash = 1e30;
  s.resources.gem = 0;
  invalidateStats();
  assert.ok(hoistGemCost(s, 'mine') > 0);
  assert.equal(g.buyHoist('mine'), false, '보석 없이 올라갔다');
  assert.equal(s.businesses.mine.hoistLevel, 4);
  setTimeSource(deviceTime);
});

test('자금과 보석이 다 있으면 올라가고 둘 다 빠진다', () => {
  const g = new Game(ok);
  const s = g.state;
  s.businesses.mine.hoistLevel = 4;
  s.resources.cash = 1e30;
  s.resources.gem = 100;
  invalidateStats();
  const cost = hoistCost(s, 'mine');
  const gems = hoistGemCost(s, 'mine');
  assert.equal(g.buyHoist('mine'), true);
  assert.equal(s.businesses.mine.hoistLevel, 5);
  assert.ok(Math.abs(s.resources.cash - (1e30 - cost)) < 1e15, '자금이 안 빠졌다');
  assert.equal(s.resources.gem, 100 - gems, '보석이 안 빠졌다');
  setTimeSource(deviceTime);
});

test('최대 단계에서는 더 못 올린다', () => {
  const g = new Game(ok);
  const s = g.state;
  s.businesses.mine.hoistLevel = HOIST_LEVELS.length;
  s.resources.cash = 1e30;
  s.resources.gem = 1e6;
  invalidateStats();
  assert.equal(g.buyHoist('mine'), false, '최대인데 더 올라갔다');
  assert.equal(hoistGemCost(s, 'mine'), 0);
  setTimeSource(deviceTime);
});
