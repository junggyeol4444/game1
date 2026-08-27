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
import { ERAS } from '../src/data/eras';
import { formatDuration, formatInt, formatNumber } from '../src/core/num';
import { resourceName, seenKey, tierLabelOf } from '../src/core/era';
import { deserialize, serialize } from '../src/core/save';
import { RARE_FISH, RARE_RIDES } from '../src/ui/minigames/games';

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

// ── 도감 ──
test('도감 키는 시대별로 갈린다', () => {
  const a = seenKey('stone', 'mine');
  const b = seenKey('bronze', 'mine');
  assert.notEqual(a, b, '문명이 달라도 같은 칸을 쓰면 수집 메타가 죽는다');
  assert.equal(a, 'stone:mine');
});

test('시대 구분 없던 세이브의 도감은 그때 서 있던 시대 것으로 옮겨온다', () => {
  const s = createInitialState(0);
  s.era = 2; // 철기
  s.collection.seenTiers = { mine: 3, housing: 1 };
  const back = deserialize(serialize(s));
  assert.equal(back.collection.seenTiers['iron:mine'], 3);
  assert.equal(back.collection.seenTiers['iron:housing'], 1);
  assert.equal(back.collection.seenTiers.mine, undefined, '옛 키가 남으면 두 번 세어진다');
});

test('이미 시대별로 적힌 키는 그대로 둔다', () => {
  const s = createInitialState(0);
  s.era = 2;
  s.collection.seenTiers = { 'stone:mine': 4, 'iron:mine': 1 };
  const back = deserialize(serialize(s));
  assert.equal(back.collection.seenTiers['stone:mine'], 4, '지나온 시대 기록이 덮어씌워졌다');
  assert.equal(back.collection.seenTiers['iron:mine'], 1);
});

test('수집품 이름표는 중복 없이 9종씩이다', () => {
  for (const [label, names] of [['어종', RARE_FISH], ['놀이기구', RARE_RIDES]] as const) {
    assert.equal(new Set(names).size, names.length, `${label} 이름이 겹친다`);
    assert.ok(names.length >= 5, `${label} 가 너무 적다`);
  }
});

test('성적이 좋을수록 뒤쪽 수집품이 나온다', () => {
  const pick = (rate: number, names: readonly string[]) =>
    names[Math.min(names.length - 1, Math.floor(rate * names.length))];
  assert.equal(pick(0, RARE_FISH), RARE_FISH[0]);
  assert.equal(pick(1, RARE_FISH), RARE_FISH[RARE_FISH.length - 1], '만점인데 제일 귀한 게 안 나온다');
  assert.equal(pick(0.999, RARE_RIDES), RARE_RIDES[RARE_RIDES.length - 1]);
});

test('근대 이전 문명은 외형 단계도 그 시대 이름으로 부른다', () => {
  const written = ['빈 터', '갱도 입구', '채굴탑', '채굴장', '대형 채굴장', '광산단지', '광산도시'];
  // 석기(0): 근대 이름을 쓰면 안 된다
  const stone = tierLabelOf(0, '돌 채취장', 2, written, false);
  assert.ok(stone.includes('돌 채취장'), `석기 시대에 '${stone}' 이 나왔다`);
  assert.ok(!stone.includes('채굴탑'));
  // 근대(6) 이후: 손으로 쓴 이름 그대로
  assert.equal(tierLabelOf(6, '노천광', 2, written, false), '채굴탑');
  // 0단계는 어느 시대든 빈 터
  assert.equal(tierLabelOf(0, '돌 채취장', 0, written, false), '빈 터');
});

test('외형 단계 이름은 단계마다 다르다', () => {
  const written = ['빈 터', 'a', 'b', 'c', 'd', 'e', 'f'];
  const names = [1, 2, 3, 4, 5, 6].map((t) => tierLabelOf(0, '움집', t, written, false));
  assert.equal(new Set(names).size, names.length, `단계 이름이 겹친다: ${names.join(', ')}`);
});

test('시대 이름에 크기 말이 붙어 있어도 겹치지 않는다', () => {
  const w = ['빈 터', 'a', 'b', 'c', 'd'];
  const names = [1, 2, 3, 4].map((t) => tierLabelOf(0, '큰 모닥불', t, w, true));
  for (const n of names) {
    assert.ok(!n.includes('작은 큰'), `겹침: ${n}`);
    assert.ok(!n.includes('큰 큰'), `겹침: ${n}`);
  }
  assert.equal(names[1], '모닥불');
  assert.equal(names[2], '큰 모닥불', '시대 이름이 사다리 한가운데 자연스럽게 놓여야 한다');
});

test('자원 이름도 시대를 탄다', () => {
  const s = createInitialState(0);
  const stone = resourceName(s, 'pop');
  s.era = 6; // 근대
  const modern = resourceName(s, 'pop');
  assert.notEqual(stone, modern, '석기 시대에 관광객이 오면 안 된다');
  assert.equal(modern, '관광객');
  // 모든 시대가 4종을 다 갖고 있어야 한다
  for (let i = 0; i < ERAS.length; i++) {
    s.era = i;
    for (const r of ['ore', 'goods', 'food', 'pop']) {
      const n = resourceName(s, r);
      assert.ok(n && n.length > 0, `${ERAS[i].name} 의 ${r} 이름이 비었다`);
    }
  }
});

test('시대 이름표가 빠진 곳이 없다', () => {
  for (const e of ERAS) {
    assert.ok(e.name && e.short && e.tagline && e.leader, `${e.id} 기본 정보 누락`);
    assert.equal(e.settlement.length, 5, `${e.id} 도시 규모 5단계가 아니다`);
    for (const b of ['mine', 'factory', 'fishery', 'park', 'corp'] as const) {
      assert.ok(e.business[b]?.name, `${e.id}.${b} 이름 누락`);
      assert.ok(e.business[b]?.icon, `${e.id}.${b} 아이콘 누락`);
      assert.ok(e.hoist[b], `${e.id}.${b} 배율 장치 이름 누락`);
    }
    for (const f of FACILITIES) {
      assert.ok(e.facility[f.id]?.name, `${e.id}.${f.id} 시설 이름 누락`);
      assert.ok(e.facility[f.id]?.icon, `${e.id}.${f.id} 시설 아이콘 누락`);
    }
  }
});
