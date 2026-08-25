/**
 * 후반 수치 안정성.
 * 방치형은 1e100 을 넘게 다룬다. 어딘가에서 NaN/Infinity 가 새면
 * 그때부터 세이브가 통째로 망가지고 되돌릴 수 없다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeOffline,
  invalidateStats,
  outputPerCycle,
  tickBusinesses,
  totalCashPerSecond,
  unitCost,
  unitMaxAffordable,
} from '../src/core/economy';
import { eraThreshold, legacyOnAdvance } from '../src/core/era';
import { createInitialState } from '../src/core/state';
import { deserialize, serialize } from '../src/core/save';
import { BUSINESSES, BUSINESS_BY_ID } from '../src/data/businesses';
import { ERAS } from '../src/data/eras';
import { FACILITIES } from '../src/data/buildings';
import { formatNumber } from '../src/core/num';

const finite = (v: number, what: string) => {
  assert.ok(Number.isFinite(v), `${what} 가 ${v} 다`);
  assert.ok(!Number.isNaN(v), `${what} 가 NaN 이다`);
};

/** 모든 시대에서 12유닛 만렙에 시설 만렙인 상태 */
function maxed(era: number, level: number) {
  const s = createInitialState(0);
  s.era = era;
  s.city.level = 40;
  s.resources.cash = 1e300;
  for (const def of BUSINESSES) {
    s.businesses[def.id].hoistLevel = 8;
    for (let i = 0; i < def.units.length; i++) {
      s.businesses[def.id].units[i] = {
        unlocked: true, level, progress: 0, running: true, equip: true, manager: true,
      };
    }
  }
  for (const f of FACILITIES) s.facilities[f.id] = { unlocked: true, level: f.maxLevel };
  s.prestige.upgrades = { output_bonus: 100, overclock: 20, facility_bonus: 20 };
  invalidateStats();
  return s;
}

test('전 시대 x 만렙에서 수치가 유한하다', () => {
  for (let era = 0; era < ERAS.length; era++) {
    for (const level of [1, 100, 1600, 5000]) {
      const s = maxed(era, level);
      const rate = totalCashPerSecond(s, 0);
      finite(rate, `${ERAS[era].name} Lv.${level} 초당수익`);
      for (const def of BUSINESSES) {
        finite(outputPerCycle(s, def, 0, 0), `${ERAS[era].name}/${def.id} 사이클 산출`);
        finite(unitCost(s, def, 0), `${ERAS[era].name}/${def.id} 레벨업 비용`);
      }
      finite(eraThreshold(s), `${ERAS[era].name} 전환 목표`);
    }
  }
});

test('만렙 상태로 오래 돌려도 NaN 이 안 샌다', () => {
  const s = maxed(8, 2000);
  for (let i = 0; i < 200; i++) tickBusinesses(s, 1, 0);
  finite(s.resources.cash, '자금');
  finite(s.city.taxRun, '회차 세수');
  finite(s.city.taxTotal, '전체 세수');
  finite(s.resources.material, '물자');
  for (const def of BUSINESSES) finite(s.businesses[def.id].totalProduced, `${def.id} 누적 생산`);
});

test('오프라인 정산도 만렙에서 유한하다', () => {
  const s = maxed(8, 2000);
  const r = computeOffline(s, 12 * 3600, 0);
  finite(r.cash, '오프라인 수익');
  finite(s.resources.cash, '정산 후 자금');
  assert.ok(r.cash >= 0, '오프라인 수익이 음수다');
});

test('만렙 상태가 세이브 왕복을 견딘다', () => {
  const s = maxed(8, 2000);
  for (let i = 0; i < 50; i++) tickBusinesses(s, 1, 0);
  const back = deserialize(serialize(s));
  finite(back.resources.cash, '복원된 자금');
  finite(back.city.taxTotal, '복원된 누적 세수');
  // 큰 수는 문자열로 나가므로 상대오차로 비교한다
  const rel = Math.abs(back.resources.cash - s.resources.cash) / Math.max(1, s.resources.cash);
  assert.ok(rel < 1e-12, `자금 정밀도 손실 ${rel}`);
});

test('예산이 무한대여도 구매 개수가 폭주하지 않는다', () => {
  const s = maxed(0, 1);
  s.resources.cash = Infinity;
  const n = unitMaxAffordable(s, BUSINESS_BY_ID.mine, 0);
  assert.ok(Number.isFinite(n), `구매 개수가 ${n} 다`);
  assert.ok(n >= 0);
});

test('유산 획득량이 목표를 크게 넘겨도 유한하다', () => {
  const s = createInitialState(0);
  s.city.taxRun = 1e300;
  const g = legacyOnAdvance(s);
  finite(g, '유산 획득량');
  assert.ok(g > 0);
});

test('표기가 1e300 까지 안 깨진다', () => {
  for (let e = 0; e <= 300; e += 10) {
    const out = formatNumber(Math.pow(10, e));
    assert.ok(!/NaN|Infinity|undefined/.test(out), `1e${e} -> ${out}`);
    assert.ok(out.length < 20, `1e${e} 표기가 너무 길다: ${out}`);
  }
});
