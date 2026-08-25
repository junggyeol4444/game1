/**
 * 실제 저장 경로 (localStorage + 체크섬 + 백업).
 * 앞선 save.test.ts 는 직렬화만 봤다. 여기서는 진짜 저장/복구를 돌린다 —
 * 여기가 깨지면 유저 데이터가 날아가고 되돌릴 방법이 없다.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// save.ts 를 불러오기 전에 localStorage 를 깔아 둔다
class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  keys() {
    return [...this.m.keys()];
  }
}
const store = new MemStore();
(globalThis as unknown as { localStorage: MemStore }).localStorage = store;

const { load, save, wipe } = await import('../src/core/save');
const { createInitialState } = await import('../src/core/state');
const { CONFIG } = await import('../src/data/config');

const KEY = CONFIG.saveKey;
const BACKUP = `${KEY}-backup`;

function grown(era = 3, cash = 1.23e18) {
  const s = createInitialState(1_700_000_000_000);
  s.era = era;
  s.city.level = 11;
  s.resources.cash = cash;
  s.resources.gem = 9;
  s.resources.blueprint = 77;
  return s;
}

beforeEach(() => store.clear());

test('저장한 뒤 불러오면 그대로 돌아온다', () => {
  const a = grown();
  save(a);
  const r = load();
  assert.equal(r.fresh, false);
  assert.equal(r.recovered, false);
  assert.equal(r.state.era, 3);
  assert.equal(r.state.resources.cash, a.resources.cash);
  assert.equal(r.state.resources.blueprint, 77);
});

test('저장본이 없으면 새 게임이다', () => {
  const r = load();
  assert.equal(r.fresh, true);
  assert.equal(r.state.era, 0);
  assert.equal(r.state.city.level, 1);
});

test('본 슬롯이 깨지면 백업으로 복구한다', () => {
  save(grown(2, 500));   // 1회차 -> 본 슬롯
  save(grown(3, 900));   // 2회차 -> 1회차가 백업으로 밀린다
  assert.ok(store.getItem(BACKUP), '백업이 안 만들어졌다');

  // 본 슬롯을 훼손한다 (체크섬 불일치)
  store.setItem(KEY, store.getItem(KEY)!.slice(0, -12) + 'AAAAAAAAAAAA');

  const r = load();
  assert.equal(r.recovered, true, '백업으로 복구되지 않았다');
  assert.equal(r.fresh, false);
  assert.equal(r.state.era, 2, '복구된 건 직전 저장본이어야 한다');
});

test('본과 백업이 둘 다 깨지면 새 게임으로 떨어진다 (크래시 금지)', () => {
  save(grown());
  save(grown());
  store.setItem(KEY, '쓰레기');
  store.setItem(BACKUP, '쓰레기');
  const r = load();
  assert.equal(r.fresh, true);
  assert.equal(r.state.era, 0);
});

test('저장본은 평문이 아니다 (난독화)', () => {
  save(grown());
  const blob = store.getItem(KEY)!;
  assert.ok(!blob.includes('blueprint'), '스키마 키가 그대로 보인다');
  assert.ok(!blob.includes('"era"'), '필드명이 그대로 보인다');
});

test('wipe 는 본과 백업을 둘 다 지운다', () => {
  save(grown());
  save(grown());
  wipe();
  assert.equal(store.getItem(KEY), null);
  assert.equal(store.getItem(BACKUP), null, '백업이 남으면 초기화가 안 된 것이다');
});

test('여러 번 저장해도 백업은 항상 직전 것이다', () => {
  for (let i = 0; i < 5; i++) save(grown(i % 9, 100 + i));
  store.setItem(KEY, '깨짐');
  const r = load();
  assert.equal(r.recovered, true);
  assert.equal(r.state.resources.cash, 103, '4회차(직전) 저장본이 아니다');
});

// ── 스키마 버전 ──
const { deserialize, serialize, migrateRaw } = await import('../src/core/save');

test('저장본에 현재 스키마 버전이 찍힌다', () => {
  const raw = serialize(grown()) as Record<string, unknown>;
  assert.equal(raw.version, CONFIG.saveVersion);
});

test('현재 버전 세이브는 그대로 통과한다', () => {
  const a = grown(4, 7e17);
  const back = deserialize(serialize(a));
  assert.equal(back.era, 4);
  assert.equal(back.resources.cash, 7e17);
});

test('버전이 없는 옛 세이브도 읽힌다 (v1 로 본다)', () => {
  const raw = serialize(grown(2, 555)) as Record<string, unknown>;
  delete raw.version;
  const back = deserialize(raw);
  assert.equal(back.era, 2);
  assert.equal(back.resources.cash, 555);
});

test('더 새 빌드의 세이브를 만나도 안 죽는다', () => {
  const raw = serialize(grown(3, 999)) as Record<string, unknown>;
  raw.version = CONFIG.saveVersion + 5;
  const back = deserialize(raw);
  // 아는 척 고치지 않고 읽을 수 있는 만큼만 읽는다
  assert.equal(back.era, 3);
  assert.ok(Number.isFinite(back.resources.cash));
});

test('올림 함수는 같은 객체를 돌려주고 버전을 안 낮춘다', () => {
  const raw = serialize(grown()) as Record<string, unknown>;
  const out = migrateRaw(raw);
  assert.equal(out, raw, '새 객체를 만들면 호출부가 옛 것을 쓴다');
  assert.equal(out.version, CONFIG.saveVersion);
});
