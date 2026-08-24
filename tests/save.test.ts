/**
 * 세이브가 깨지면 유저 데이터가 날아간다. 여기가 제일 먼저 테스트할 곳이다.
 *   npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deserialize, exportSave, importSave, serialize } from '../src/core/save';
import { TUTORIAL_DONE, createInitialState, migrate } from '../src/core/state';
import { CONFIG } from '../src/data/config';

function grown() {
  const s = createInitialState(1_700_000_000_000);
  s.era = 3;
  s.tutorial = TUTORIAL_DONE;
  s.city.level = 9;
  s.city.taxRun = 1.2345e18;
  s.city.taxTotal = 9.87e21;
  s.city.pop = 4321.5;
  s.resources.cash = 6.02e23;
  s.resources.material = 1.5e12;
  s.resources.gem = 17;
  s.resources.blueprint = 340;
  s.businesses.mine.units[0] = { unlocked: true, level: 512, progress: 0.25, running: true, equip: true, manager: true };
  s.businesses.mine.hoistLevel = 5;
  s.facilities.housing = { unlocked: true, level: 22 };
  s.prestige.count = 3;
  s.prestige.upgrades = { output_bonus: 7, keep_manager: 2 };
  s.collection.fish = ['참돔', '방어'];
  s.stats.cashEarnedTotal = 5e25;
  return s;
}

test('직렬화 -> 역직렬화 왕복에서 값이 살아남는다', () => {
  const a = grown();
  const b = deserialize(serialize(a));

  assert.equal(b.era, a.era);
  assert.equal(b.tutorial, a.tutorial);
  assert.equal(b.city.level, a.city.level);
  assert.equal(b.city.taxRun, a.city.taxRun);
  assert.equal(b.city.taxTotal, a.city.taxTotal);
  assert.equal(b.resources.cash, a.resources.cash);
  assert.equal(b.resources.material, a.resources.material);
  assert.equal(b.resources.gem, a.resources.gem);
  assert.equal(b.resources.blueprint, a.resources.blueprint);
  assert.equal(b.businesses.mine.units[0].level, 512);
  assert.equal(b.businesses.mine.units[0].manager, true);
  assert.equal(b.businesses.mine.hoistLevel, 5);
  assert.equal(b.facilities.housing.level, 22);
  assert.equal(b.prestige.count, 3);
  assert.deepEqual(b.prestige.upgrades, a.prestige.upgrades);
});

test('큰 수가 문자열로 나가고 정밀도를 잃지 않는다', () => {
  const s = grown();
  const raw = serialize(s) as Record<string, Record<string, unknown>>;
  assert.equal(typeof raw.currency.money, 'string');
  assert.equal(typeof raw.city.total_tax, 'string');
  assert.equal(Number(raw.currency.money), s.resources.cash);
  assert.equal(Number(raw.city.total_tax), s.city.taxTotal);
});

test('내보내기 -> 가져오기 왕복', () => {
  const a = grown();
  const b = importSave(exportSave(a));
  assert.ok(b, '가져오기가 null 을 돌려주면 안 된다');
  assert.equal(b!.era, a.era);
  assert.equal(b!.resources.cash, a.resources.cash);
  assert.equal(b!.city.level, a.city.level);
});

test('망가진 세이브를 가져오면 null 이다', () => {
  assert.equal(importSave('완전 쓰레기'), null);
  assert.equal(importSave(''), null);
});

test('migrate: 시대 필드가 없는 옛 세이브는 석기 시대로 들어온다', () => {
  const old = createInitialState(0) as Record<string, unknown>;
  delete old.era;
  const m = migrate(old);
  assert.ok(m);
  assert.equal(m!.era, 0);
});

test('migrate: 튜토리얼 필드가 없는 옛 세이브는 튜토리얼을 다시 안 띄운다', () => {
  const old = createInitialState(0) as Record<string, unknown>;
  delete old.tutorial;
  const m = migrate(old);
  assert.ok(m);
  assert.equal(m!.tutorial, TUTORIAL_DONE, '기존 유저에게 튜토리얼이 다시 뜨면 안 된다');
});

test('migrate: 시대 값이 범위를 벗어나면 잘린다', () => {
  const bad = createInitialState(0) as Record<string, unknown>;
  bad.era = 999;
  assert.equal(migrate(bad)!.era, 8);
  bad.era = -5;
  assert.equal(migrate(bad)!.era, 0);
});

test('migrate: 객체가 아니면 null', () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate('문자열'), null);
});

test('새 게임은 석기 시대 빈 들판에서 시작한다', () => {
  const s = createInitialState(0);
  assert.equal(s.era, 0);
  assert.equal(s.city.level, 1);
  assert.equal(s.tutorial, 0, '새 유저는 튜토리얼 0단계');
  assert.equal(s.resources.cash, CONFIG.startCash);
  assert.equal(s.businesses.mine.units[0].unlocked, true, '첫 유닛만 열려 있다');
  assert.equal(s.businesses.mine.units[1].unlocked, false);
  assert.equal(s.businesses.factory.units[0].unlocked, false);
  for (const f of Object.values(s.facilities)) assert.equal(f.level, 0, '시설은 하나도 없다');
});
