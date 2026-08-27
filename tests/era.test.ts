/**
 * 문명 전환은 도시를 통째로 날린다. 잘못 날리면 되돌릴 수 없다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceEra, canAdvanceEra, cityRequirement } from '../src/core/progression';
import { eraTargetLevel, eraThreshold, legacyOnAdvance } from '../src/core/era';
import { createInitialState } from '../src/core/state';
import { ERAS, MAX_ERA } from '../src/data/eras';
import { CONFIG } from '../src/data/config';
import { invalidateStats, unitCost, unitUnlockCost, cycleTime } from '../src/core/economy';
import { BUSINESS_BY_ID } from '../src/data/businesses';

function atThreshold(era: number) {
  const s = createInitialState(0);
  s.era = era;
  s.city.taxRun = eraThreshold(s);
  s.city.level = eraTargetLevel(s);
  invalidateStats();
  return s;
}

test('졸업 목표는 시대마다 올라간다', () => {
  for (let i = 1; i < ERAS.length; i++) {
    assert.ok(
      ERAS[i].advanceLevel > ERAS[i - 1].advanceLevel,
      `${ERAS[i].name} 목표 레벨이 이전 시대보다 낮거나 같다`,
    );
  }
});

test('비용·사이클 배율은 시대마다 올라간다 (전환은 완전 초기화다)', () => {
  for (let i = 1; i < ERAS.length; i++) {
    assert.ok(ERAS[i].costMult > ERAS[i - 1].costMult, `${ERAS[i].name} 비용 배율이 안 올랐다`);
    assert.ok(ERAS[i].cycleMult > ERAS[i - 1].cycleMult, `${ERAS[i].name} 사이클 배율이 안 올랐다`);
  }
  assert.equal(ERAS[0].costMult, 1);
  assert.equal(ERAS[0].cycleMult, 1);
});

test('시대가 오르면 같은 유닛이 더 비싸고 더 느리다', () => {
  const def = BUSINESS_BY_ID.mine;
  const a = createInitialState(0);
  const b = createInitialState(0);
  b.era = 4;
  invalidateStats();
  assert.ok(unitCost(b, def, 0) > unitCost(a, def, 0), '레벨업 비용이 안 올랐다');
  assert.ok(unitUnlockCost(b, def, 3) > unitUnlockCost(a, def, 3), '해금 비용이 안 올랐다');
  assert.ok(cycleTime(b, def, 0) > cycleTime(a, def, 0), '사이클이 안 느려졌다');
  assert.equal(unitCost(b, def, 0) / unitCost(a, def, 0), ERAS[4].costMult);
});

test('목표 세수에 못 미치면 전환 못 한다', () => {
  const s = createInitialState(0);
  s.city.taxRun = eraThreshold(s) - 1;
  assert.equal(canAdvanceEra(s), false);
  assert.equal(legacyOnAdvance(s), 0, '목표 미달인데 유산이 나오면 안 된다');
  s.city.taxRun = eraThreshold(s);
  assert.equal(canAdvanceEra(s), true);
  assert.ok(legacyOnAdvance(s) > 0);
});

test('전환하면 도시가 통째로 날아가고 유산 강화만 남는다', () => {
  const s = atThreshold(0);
  s.resources.cash = 9e15;
  s.resources.material = 1e9;
  s.resources.gem = 42;
  s.resources.blueprint = 100;
  s.prestige.upgrades = { output_bonus: 5 };
  s.facilities.housing = { unlocked: true, level: 30 };
  s.businesses.mine.units[3] = { unlocked: true, level: 200, progress: 0, running: true, equip: true, manager: true };
  s.collection.fish = ['참돔'];
  s.city.taxTotal = 12345;

  const gain = legacyOnAdvance(s);
  advanceEra(s, gain, 0);

  // 날아간 것
  assert.equal(s.city.level, 1, '도시 레벨이 1로 안 돌아갔다');
  assert.equal(s.city.taxRun, 0, '회차 세수가 안 지워졌다');
  assert.equal(s.resources.cash, CONFIG.startCash);
  assert.equal(s.resources.material, 0);
  assert.equal(s.facilities.housing.level, 0, '시설이 안 허물어졌다');
  assert.equal(s.businesses.mine.units[3].level, 0, '사업이 안 초기화됐다');
  assert.equal(s.businesses.mine.units[3].unlocked, false);

  // 남은 것
  assert.equal(s.era, 1, '시대가 안 올랐다');
  assert.equal(s.resources.gem, 42, '보석은 남아야 한다');
  assert.equal(s.resources.blueprint, 100 + gain, '유산이 안 들어왔다');
  assert.deepEqual(s.prestige.upgrades, { output_bonus: 5 }, '유산 강화가 날아갔다');
  assert.deepEqual(s.collection.fish, ['참돔'], '도감이 날아갔다');
  assert.equal(s.city.taxTotal, 12345, '전체 누적 세수는 유지된다');
  assert.equal(s.prestige.count, 1);

  // 첫 유닛은 다시 열려 있어야 한다 (아니면 아무것도 못 한다)
  assert.equal(s.businesses.mine.units[0].unlocked, true);
  assert.equal(s.businesses.mine.units[0].level, 1);
});

test('시작 자금 강화가 전환 후에 적용된다', () => {
  const s = atThreshold(0);
  s.prestige.upgrades = { start_fund: 2 };
  advanceEra(s, 0, 0);
  assert.equal(s.resources.cash, CONFIG.startCash * 100);
});

test('자동화 유지 강화가 매니저를 앞에서부터 남긴다', () => {
  const s = atThreshold(0);
  s.prestige.upgrades = { keep_manager: 2 };
  for (let i = 0; i < 5; i++) {
    s.businesses.mine.units[i] = { unlocked: true, level: 10, progress: 0, running: false, equip: true, manager: true };
  }
  advanceEra(s, 0, 0);
  const kept = s.businesses.mine.units.filter((u) => u.manager).length;
  assert.equal(kept, 2, '유지 개수가 강화 레벨과 다르다');
  assert.equal(s.businesses.mine.units[0].manager, true, '앞에서부터 남겨야 한다');
  assert.equal(s.businesses.mine.units[2].manager, false);
});

test('마지막 시대에서는 시대가 안 오르고 목표만 올라간다', () => {
  const s = createInitialState(0);
  s.era = MAX_ERA;
  s.prestige.count = MAX_ERA;
  const before = eraTargetLevel(s);
  s.city.taxRun = eraThreshold(s);
  advanceEra(s, legacyOnAdvance(s), 0);
  assert.equal(s.era, MAX_ERA, '마지막 시대를 넘어가면 안 된다');
  assert.equal(eraTargetLevel(s), before + CONFIG.era.repeatLevels, '반복 목표가 안 올랐다');
});

test('유산 획득량은 시대마다 커진다', () => {
  const gains = ERAS.map((_, i) => {
    const s = createInitialState(0);
    s.era = i;
    s.city.taxRun = eraThreshold(s);
    return legacyOnAdvance(s);
  });
  for (let i = 1; i < gains.length; i++) {
    assert.ok(gains[i] > gains[i - 1], `${ERAS[i].name} 유산이 안 늘었다: ${gains.join(',')}`);
  }
});

test('목표를 넘겨서 키우면 유산이 더 나오지만 완만하다', () => {
  const s = createInitialState(0);
  const base = eraThreshold(s);
  s.city.taxRun = base;
  const at1 = legacyOnAdvance(s);
  s.city.taxRun = base * 4;
  const at4 = legacyOnAdvance(s);
  assert.equal(at4, at1 * 2, '4배로 키우면 정확히 2배(sqrt)여야 한다');
});

test('전환 목표 세수는 도시 레벨 요구치와 같다', () => {
  const s = createInitialState(0);
  assert.equal(eraThreshold(s), cityRequirement(ERAS[0].advanceLevel));
});
