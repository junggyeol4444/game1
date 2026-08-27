/**
 * 매일 도는 루프들 — 이벤트(화재/도난) · 미션 · 출석 · 자원 사슬.
 * 넷 다 테스트가 한 줄도 없었다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeEvent, tickEvents } from '../src/core/events';
import { allMissionsClaimed, bumpMission, missionComplete, missionTarget, refreshMissions } from '../src/core/missions';
import { chainActive, invalidateStats, projectedEfficiency, tickBusinesses, totalCashPerSecond } from '../src/core/economy';
import { createInitialState, todayKey } from '../src/core/state';
import { CONFIG } from '../src/data/config';
import { BUSINESS_BY_ID } from '../src/data/businesses';

function running(cityLevel = 8) {
  const s = createInitialState(0);
  s.city.level = cityLevel;
  for (const id of ['mine', 'factory'] as const) {
    for (let i = 0; i < 4; i++) {
      s.businesses[id].units[i] = { unlocked: true, level: 20, progress: 0, running: true, equip: true, manager: true };
    }
  }
  s.resources.cash = 1e9;
  invalidateStats();
  return s;
}

// ── 이벤트 ──
test('도시 레벨이 낮으면 사고가 안 난다', () => {
  const s = running(CONFIG.events.startCityLevel - 1);
  s.nextEventAt = 0;
  for (let i = 0; i < 50; i++) tickEvents(s, i * 1000);
  assert.equal(s.events.length, 0, '초반 유저에게 사고가 났다');
});

test('사고는 정해진 간격 전에는 안 난다', () => {
  const s = running();
  s.nextEventAt = 10_000;
  for (let t = 0; t < 10_000; t += 500) tickEvents(s, t);
  assert.equal(s.events.length, 0, '예정 시각 전에 사고가 났다');
});

test('사고가 나면 결국 끝난다 (영구 화재 금지)', () => {
  const s = running();
  s.nextEventAt = 0;
  let fired = 0;
  let t = 0;
  for (; t < 3_000_000 && s.events.length === 0; t += 1000) {
    fired += tickEvents(s, t).length;
  }
  assert.ok(fired > 0 && s.events.length > 0, '아무 사고도 안 났다');
  const ev = s.events[0];
  assert.ok(Number.isFinite(ev.until) && ev.until > t, `만료 시각이 ${ev.until} 다`);

  // 만료 시각을 지나면 정리된다. 새 사고가 끼어들지 않게 다음 발생은 멀리 밀어 둔다
  const after = ev.until + 1000;
  s.nextEventAt = after + 1_000_000;
  tickEvents(s, after);
  assert.equal(s.events.filter((e) => e.until > after).length, 0, '사고가 안 끝난다');
});

test('사고 알림이 시대 이름을 쓴다', () => {
  const s = running();
  s.era = 0;
  s.nextEventAt = 0;
  const seen: string[] = [];
  for (let t = 0; t < 3_000_000 && seen.length < 3; t += 1000) {
    for (const n of tickEvents(s, t)) seen.push(n.text);
  }
  assert.ok(seen.length > 0, '알림이 하나도 안 나왔다');
  for (const text of seen) {
    assert.ok(!text.includes('광산'), `석기 시대인데 '광산' 이라고 뜬다: ${text}`);
    assert.ok(!text.includes('공장'), `석기 시대인데 '공장' 이라고 뜬다: ${text}`);
  }
});

test('도난이 자금을 마이너스로 만들지 않는다', () => {
  for (let seed = 0; seed < 40; seed++) {
    const s = running();
    s.resources.cash = 100; // 수입에 비해 아주 적게
    s.nextEventAt = 0;
    for (let t = 0; t < 200_000; t += 1000) {
      tickEvents(s, t);
      assert.ok(s.resources.cash >= 0, `자금이 ${s.resources.cash} 가 됐다`);
      assert.ok(Number.isFinite(s.resources.cash), `자금이 ${s.resources.cash} 다`);
    }
  }
});

test('화재는 그 사업만 때린다', () => {
  const s = running();
  s.events.push({ id: 'f', kind: 'fire', target: 'mine', until: 999_999, severity: 0.5 });
  assert.ok(activeEvent(s, 'mine', 0), '광산 화재가 조회 안 된다');
  assert.equal(activeEvent(s, 'factory', 0), null, '공장까지 불이 붙었다');
});

// ── 미션 ──
test('하루 미션은 3개, 목표는 1 이상', () => {
  const s = running();
  refreshMissions(s, 0);
  assert.equal(s.missions.ids.length, CONFIG.missions.count);
  assert.equal(new Set(s.missions.ids).size, s.missions.ids.length, '같은 미션이 중복됐다');
  s.missions.targets.forEach((t, i) => assert.ok(t >= 1, `${i}번 목표가 ${t}`));
});

test('같은 날 다시 부르면 미션이 안 바뀐다 (리롤 금지)', () => {
  const s = running();
  refreshMissions(s, 0);
  const before = [...s.missions.ids];
  const targets = [...s.missions.targets];
  s.missions.progress[0] = 5;
  assert.equal(refreshMissions(s, 1000), false);
  assert.deepEqual(s.missions.ids, before);
  assert.deepEqual(s.missions.targets, targets, '진행 중에 목표가 움직였다');
  assert.equal(s.missions.progress[0], 5, '진행도가 날아갔다');
});

test('날이 바뀌면 새로 뽑힌다', () => {
  const s = running();
  refreshMissions(s, 0);
  const day0 = s.missions.day;
  const next = new Date('2030-01-02T12:00:00Z').getTime();
  assert.equal(refreshMissions(s, next), true);
  assert.notEqual(s.missions.day, day0);
  assert.ok(s.missions.progress.every((p) => p === 0), '진행도가 초기화 안 됐다');
});

test('해금 안 된 사업의 미션은 안 나온다', () => {
  const s = running(1); // 광산만 열림
  refreshMissions(s, 0);
  for (const id of s.missions.ids) {
    assert.ok(!id.startsWith('produce_corp'), '기업이 안 열렸는데 기업 미션이 나왔다');
    assert.ok(!id.startsWith('produce_park'), '놀이공원이 안 열렸는데 미션이 나왔다');
  }
});

test('진행도가 목표를 넘어야 완료다', () => {
  const s = running();
  refreshMissions(s, 0);
  const target = missionTarget(s, 0);
  assert.equal(missionComplete(s, 0), false);
  s.missions.progress[0] = target - 1;
  assert.equal(missionComplete(s, 0), false);
  s.missions.progress[0] = target;
  assert.equal(missionComplete(s, 0), true);
});

test('bump 은 해당 이벤트 미션만 올린다', () => {
  const s = running();
  s.missions = {
    day: todayKey(0),
    ids: ['earn10m', 'tap50'],
    targets: [100, 100],
    progress: [0, 0],
    claimed: [false, false],
  };
  bumpMission(s, 'cashEarned', 10);
  assert.equal(s.missions.progress[0], 10);
  assert.equal(s.missions.progress[1], 0, '관계없는 미션이 올랐다');
});

test('전부 수령해야 allMissionsClaimed', () => {
  const s = running();
  refreshMissions(s, 0);
  assert.equal(allMissionsClaimed(s), false);
  s.missions.claimed = s.missions.claimed.map(() => true);
  assert.equal(allMissionsClaimed(s), true);
});

// ── 출석 ──
test('출석 보상 7일치가 정의돼 있다', () => {
  assert.equal(CONFIG.attendance.rewards.length, 7);
  for (const r of CONFIG.attendance.rewards) {
    assert.ok(['cashSeconds', 'boost', 'blueprint'].includes(r.type), `모르는 보상 종류 ${r.type}`);
    assert.ok(r.amount > 0);
  }
});

// ── 자원 사슬 ──
test('사슬은 도시 Lv.12 전에는 안 켜진다', () => {
  const s = running(CONFIG.chainStartLevel - 1);
  assert.equal(chainActive(s), false);
  assert.equal(projectedEfficiency(s, BUSINESS_BY_ID.factory, 0), 1, '사슬 전인데 가동률이 깎였다');
  s.city.level = CONFIG.chainStartLevel;
  assert.equal(chainActive(s), true);
});

test('상위 자원이 0이어도 최소 가동률은 돈다', () => {
  const s = running(CONFIG.chainStartLevel);
  s.resources.ore = 0;
  invalidateStats();
  const eff = projectedEfficiency(s, BUSINESS_BY_ID.factory, 0);
  assert.ok(eff >= CONFIG.chainIdleFloor - 1e-9, `가동률이 ${eff} 로 하한 아래다`);
  assert.ok(eff <= 1);
});

test('사슬이 켜져도 수입이 0이 되지 않는다', () => {
  const s = running(CONFIG.chainStartLevel);
  s.resources.ore = 0;
  invalidateStats();
  for (let i = 0; i < 60; i++) tickBusinesses(s, 1, 0);
  assert.ok(totalCashPerSecond(s, 0) > 0, '사슬이 수입을 0으로 만들었다');
  assert.ok(Number.isFinite(s.resources.cash));
});

test('하위 사업이 자원을 먹어도 상위 수입은 안 줄어든다', () => {
  const s = running(CONFIG.chainStartLevel);
  s.resources.ore = 1e9;
  invalidateStats();
  const mineRateBefore = totalCashPerSecond(s, 0);
  for (let i = 0; i < 30; i++) tickBusinesses(s, 1, 0);
  invalidateStats();
  assert.ok(totalCashPerSecond(s, 0) >= mineRateBefore * 0.999, '상위 수입이 깎였다');
});

test('도난이 자금을 NaN 으로 만들지 않는다', () => {
  const s = running();
  s.nextEventAt = 0;
  s.resources.cash = NaN;
  for (let t = 0; t < 200_000; t += 1000) tickEvents(s, t);
  // NaN 상태를 더 악화시키지 않는지 (빼기로 새 NaN 을 만들지 않는지) 확인
  const s2 = running();
  s2.nextEventAt = 0;
  s2.resources.cash = 1000;
  for (let t = 0; t < 500_000; t += 1000) {
    tickEvents(s2, t);
    assert.ok(Number.isFinite(s2.resources.cash), `자금이 ${s2.resources.cash} 가 됐다`);
  }
});
