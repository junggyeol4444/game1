/**
 * 시설 게이트와 숫자 표기.
 * 게이트가 잘못 잠기면 게임 시작부터 데드락이고, 표기가 깨지면 55+ 코호트가 못 읽는다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityStats, facilityCost, facilityUnlocked, staffedUnits } from '../src/core/facilities';
import { invalidateStats, staffed } from '../src/core/economy';
import { createInitialState } from '../src/core/state';
import { CONFIG } from '../src/data/config';
import { FACILITIES } from '../src/data/buildings';
import { formatDuration, formatInt, formatNumber } from '../src/core/num';

function fresh() {
  const s = createInitialState(0);
  invalidateStats();
  return s;
}

test('아무것도 없어도 1번 유닛은 돈다 (시작 데드락 방지)', () => {
  const s = fresh();
  const cs = cityStats(s);
  assert.ok(cs.popCap >= CONFIG.facility.popBase, '기본 인구가 없다');
  assert.ok(cs.powerSupply >= CONFIG.facility.powerBase, '기본 전력이 없다');
  assert.ok(staffed(s, 'mine') >= 1, '첫 유닛조차 못 돌리면 게임을 시작할 수 없다');
});

test('전력이 모자라도 완전히 멈추지 않는다 (최소 가동률)', () => {
  const s = fresh();
  for (let i = 0; i < 12; i++) {
    s.businesses.mine.units[i] = { unlocked: true, level: 99, progress: 0, running: false, equip: false, manager: true };
  }
  invalidateStats();
  const cs = cityStats(s);
  assert.ok(cs.powerEff >= CONFIG.facility.gateFloor, `가동률 ${cs.powerEff} 가 하한 아래다`);
  assert.ok(cs.powerEff <= 1);
});

test('인구가 감당하는 유닛은 앞에서부터 채운다', () => {
  const s = fresh();
  for (let i = 0; i < 12; i++) {
    s.businesses.mine.units[i] = { unlocked: true, level: 5, progress: 0, running: false, equip: false, manager: true };
  }
  invalidateStats();
  const cs = cityStats(s);
  const staff = staffedUnits(s, cs);
  assert.ok(staff.mine >= 1);
  assert.ok(staff.mine <= 12);
  // 주거지를 지으면 더 돌아야 한다
  s.facilities.housing = { unlocked: true, level: 20 };
  invalidateStats();
  const staff2 = staffedUnits(s, cityStats(s));
  assert.ok(staff2.mine >= staff.mine, '주거지를 지었는데 가동 유닛이 줄었다');
});

test('시설 비용은 레벨마다 오르고 최대 레벨에서 무한대다', () => {
  const s = fresh();
  for (const f of FACILITIES) {
    const c0 = facilityCost(s, f.id);
    s.facilities[f.id] = { unlocked: true, level: 5 };
    const c5 = facilityCost(s, f.id);
    assert.ok(c5 > c0, `${f.name} 비용이 안 올랐다`);
    s.facilities[f.id] = { unlocked: true, level: f.maxLevel };
    assert.equal(facilityCost(s, f.id), Infinity, `${f.name} 최대 레벨인데 더 살 수 있다`);
  }
});

test('시설 해금은 도시 레벨을 따른다', () => {
  const s = fresh();
  for (const f of FACILITIES) {
    s.city.level = 1;
    if (f.unlockCityLevel > 1) assert.equal(facilityUnlocked(s, f.id), false, `${f.name} 이 Lv.1에 열려 있다`);
    s.city.level = f.unlockCityLevel;
    assert.equal(facilityUnlocked(s, f.id), true, `${f.name} 이 Lv.${f.unlockCityLevel}에 안 열렸다`);
  }
});

test('세수·산출 배율은 1 이상이다 (시설이 손해면 안 된다)', () => {
  const s = fresh();
  const cs = cityStats(s);
  assert.ok(cs.taxMult >= 1);
  assert.ok(cs.outputMult >= 1);
});

// ── 숫자 표기 ──
test('축약 표기 — 뒤 0 은 떼고 보여준다', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1000), '1K');
  assert.equal(formatNumber(1234), '1.23K');
  assert.equal(formatNumber(1_500_000), '1.5M');
  assert.equal(formatNumber(1e9), '1B');
  assert.equal(formatNumber(1e12), '1T');
});

test('T 를 넘으면 aa, ab ... 로 이어진다', () => {
  assert.equal(formatNumber(1e15), '1aa');
  assert.equal(formatNumber(1e18), '1ab');
  assert.notEqual(formatNumber(1e18), formatNumber(1e15), '자릿수가 달라도 접미사가 같다');
});

test('999.99K 가 1000K 로 새지 않는다', () => {
  for (const v of [999_999, 999_999_999, 999.9999e12]) {
    const out = formatNumber(v);
    assert.ok(!out.startsWith('1000'), `${v} -> ${out} (자리 넘김 실패)`);
  }
});

test('아주 큰 수도 NaN/Infinity 를 뱉지 않는다', () => {
  for (const v of [1e30, 1e60, 1e100, Number.MAX_VALUE]) {
    const out = formatNumber(v);
    assert.ok(!out.includes('NaN'), `${v} -> ${out}`);
    assert.ok(!out.includes('Infinity'), `${v} -> ${out}`);
  }
});

test('음수와 비정상 값을 안전하게 처리한다', () => {
  for (const v of [-1, -1e9, NaN, Infinity, -Infinity]) {
    const out = formatNumber(v);
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0, `${v} 가 빈 문자열이 됐다`);
  }
  assert.equal(typeof formatInt(NaN), 'string');
});

test('지수 표기 모드', () => {
  const out = formatNumber(1.234e20, 'scientific');
  assert.match(out, /e/, `지수 표기가 아니다: ${out}`);
});

test('시간 표기', () => {
  assert.match(formatDuration(0), /초/);
  assert.match(formatDuration(90), /분/);
  assert.match(formatDuration(3600 * 5), /시간/);
  assert.match(formatDuration(86400 * 3), /일/);
});
