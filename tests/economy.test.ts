/**
 * 경제 계산. 여기가 틀리면 익스플로잇이거나 진행이 막힌다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeOffline,
  invalidateStats,
  milestoneBonus,
  offlineCapSeconds,
  offlineRate,
  tickBusinesses,
  totalCashPerSecond,
  unitCost,
  unitMaxAffordable,
} from '../src/core/economy';
import { canAfford, geometricCost, maxAffordable } from '../src/core/num';
import { createInitialState } from '../src/core/state';
import { CONFIG } from '../src/data/config';
import { BUSINESS_BY_ID } from '../src/data/businesses';
import { applyCityLevelUps } from '../src/core/progression';
import { cityRequirement } from '../src/data/buildings';

function fresh() {
  const s = createInitialState(0);
  invalidateStats();
  return s;
}

test('등비 비용 합이 한 개씩 산 것과 같다', () => {
  const base = 100;
  const g = 1.07;
  let byOne = 0;
  for (let i = 0; i < 10; i++) byOne += geometricCost(base, g, i, 1);
  const bulk = geometricCost(base, g, 0, 10);
  assert.ok(Math.abs(byOne - bulk) < 1e-6, `한 개씩 ${byOne} vs 묶음 ${bulk}`);
});

test('살 수 있는 최대 개수는 예산을 넘지 않는다', () => {
  const base = 100;
  const g = 1.07;
  for (const budget of [0, 99, 100, 1000, 1e6, 1e12]) {
    const n = maxAffordable(base, g, 0, budget);
    assert.ok(geometricCost(base, g, 0, n) <= budget + 1e-6, `${budget} 예산에 ${n}개는 초과다`);
    if (n > 0) {
      assert.ok(
        geometricCost(base, g, 0, n + 1) > budget,
        `${budget} 예산에 ${n + 1}개도 살 수 있는데 안 샀다`,
      );
    }
  }
});

test('돈이 없으면 0개', () => {
  const s = fresh();
  s.resources.cash = 0;
  assert.equal(unitMaxAffordable(s, BUSINESS_BY_ID.mine, 0), 0);
});

test('마일스톤은 누적 x2, 사이클 반감은 최대 1/16', () => {
  assert.deepEqual(milestoneBonus(1), { output: 1, speed: 1 });
  assert.equal(milestoneBonus(10).output, 2);
  assert.equal(milestoneBonus(25).output, 4);
  assert.equal(milestoneBonus(25).speed, 2);
  assert.equal(milestoneBonus(1600).output, Math.pow(2, CONFIG.milestones.length));
  assert.equal(milestoneBonus(1600).speed, 16, '사이클 반감은 4단계까지');
  assert.equal(milestoneBonus(99999).speed, 16, '반감이 무한정 쌓이면 안 된다');
});

test('오프라인은 상한을 넘겨 정산하지 않는다', () => {
  const s = fresh();
  s.businesses.mine.units[0].manager = true;
  s.businesses.mine.units[0].level = 20;
  invalidateStats();
  const cap = offlineCapSeconds(s);
  const r = computeOffline(s, cap * 10, 0);
  assert.equal(r.cappedSeconds, cap, '상한이 안 걸렸다');
  assert.ok(r.seconds > r.cappedSeconds);
});

test('오프라인 시간이 음수여도 돈이 생기지 않는다', () => {
  const s = fresh();
  s.businesses.mine.units[0].manager = true;
  s.businesses.mine.units[0].level = 20;
  invalidateStats();
  const before = s.resources.cash;
  const r = computeOffline(s, -99999, 0);
  assert.equal(r.cappedSeconds, 0);
  assert.equal(s.resources.cash, before, '시간을 되돌려 돈을 벌 수 있으면 안 된다');
});

test('자동화 안 된 유닛은 오프라인 수익이 0이다', () => {
  const s = fresh();
  s.businesses.mine.units[0].level = 50; // 매니저도 설비도 없다
  invalidateStats();
  const r = computeOffline(s, 3600, 0);
  assert.equal(r.cash, 0, '수동 유닛이 오프라인에 벌면 안 된다');
});

test('오프라인 효율은 항상 1 이하다', () => {
  const s = fresh();
  for (let lv = 0; lv <= 5; lv++) {
    s.city.effLevel = lv;
    assert.ok(offlineRate(s) <= 1, `${lv}단계 효율이 100%를 넘는다`);
  }
});

test('아무것도 안 지으면 초당 수익이 0이다', () => {
  const s = fresh();
  s.businesses.mine.units[0].level = 0;
  s.businesses.mine.units[0].unlocked = false;
  invalidateStats();
  assert.equal(totalCashPerSecond(s, 0), 0);
});

test('수동 유닛 1개를 돌리면 세수가 쌓이고 도시 레벨이 오른다', () => {
  const s = fresh();
  s.businesses.mine.units[0].level = 1;
  s.businesses.mine.units[0].running = true;
  let guard = 0;
  while (s.city.taxRun < cityRequirement(2) && guard++ < 200_000) {
    s.businesses.mine.units[0].running = true;
    tickBusinesses(s, 1, 0);
  }
  assert.ok(s.city.taxRun >= cityRequirement(2), '세수가 안 쌓인다');
  applyCityLevelUps(s);
  assert.ok(s.city.level >= 2, '도시 레벨이 안 오른다');
});

test('사업 해금은 도시 레벨을 따른다', () => {
  const s = fresh();
  assert.equal(BUSINESS_BY_ID.mine.unlockCityLevel, 1, '광산은 처음부터 열려 있어야 한다');
  for (const id of ['factory', 'fishery', 'park', 'corp'] as const) {
    assert.ok(BUSINESS_BY_ID[id].unlockCityLevel > 1, `${id} 가 처음부터 열려 있다`);
  }
  void s;
});

test('유닛 비용은 레벨이 오를수록 비싸진다', () => {
  const s = fresh();
  const def = BUSINESS_BY_ID.mine;
  const c1 = unitCost(s, def, 0);
  s.businesses.mine.units[0].level = 50;
  const c50 = unitCost(s, def, 0);
  assert.ok(c50 > c1, '비용이 안 올랐다');
});

test('도시 레벨 요구 세수는 단조 증가한다', () => {
  for (let l = 2; l <= 40; l++) {
    assert.ok(cityRequirement(l) > cityRequirement(l - 1), `Lv.${l} 요구치가 이전보다 낮다`);
  }
  assert.equal(cityRequirement(1), 0);
});

test('비정상 예산으로는 아무것도 못 산다 (세이브 파손 방지)', () => {
  for (const budget of [Infinity, NaN, -Infinity]) {
    const n = maxAffordable(100, 1.07, 0, budget);
    assert.equal(n, 0, `예산 ${budget} 에서 ${n} 개를 샀다`);
  }
  // 레벨이 너무 깊어 첫 비용이 오버플로해도 0
  assert.equal(maxAffordable(100, 1.07, 100000, 1e300), 0);
});

test('보유가 NaN/Infinity 면 결제가 막힌다', () => {
  assert.equal(canAfford(NaN, 10), false, 'NaN 이면 비교가 false 라 공짜로 사진다');
  assert.equal(canAfford(Infinity, 10), false);
  assert.equal(canAfford(100, NaN), false);
  assert.equal(canAfford(100, Infinity), false);
  assert.equal(canAfford(100, -5), false, '음수 비용으로 돈을 벌 수 있으면 안 된다');
  assert.equal(canAfford(100, 100), true);
  assert.equal(canAfford(99, 100), false);
});

test('자금이 NaN 이면 아무것도 못 산다', () => {
  const s = fresh();
  s.resources.cash = NaN;
  const def = BUSINESS_BY_ID.mine;
  assert.equal(canAfford(s.resources.cash, unitCost(s, def, 0)), false);
});
