/**
 * 밸런스 시뮬레이터. 탐욕적 구매 AI로 진행 속도를 측정한다.
 *   npm run sim -- --days 14
 */
import { BUSINESSES } from '../src/data/businesses';
import { FACILITIES, cityUnlockText } from '../src/data/buildings';
import { CONFIG } from '../src/data/config';
import { HOIST_LEVELS } from '../src/data/units';
import {
  businessRatePerSecond,
  cycleTime,
  hoistCost,
  isUnlocked,
  managerCost,
  outputPerCycle,
  projectedEfficiency,
  staffed,
  tickBusinesses,
  totalCashPerSecond,
  unitCost,
  unitUnlockCost,
} from '../src/core/economy';
import { cityStats, facilityCost, facilityLevel, facilityUnlocked, buyFacility } from '../src/core/facilities';
import { applyCityLevelUps, blueprintsOnPrestige, cityRequirement } from '../src/core/progression';
import { computeOffline } from '../src/core/economy';
import { createInitialState } from '../src/core/state';
import { formatDuration, formatNumber } from '../src/core/num';

declare const process: { argv: string[] };
const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 14;

const state = createInitialState(0);
let t = 0;
const dt = 2;
const marks: string[] = [];
const seen = new Set<number>([1]);

function buyStep(): boolean {
  // 1) 해금 가능한 유닛
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    for (let i = 0; i < def.units.length; i++) {
      const u = state.businesses[def.id].units[i];
      if (!u.unlocked && state.resources.cash >= unitUnlockCost(def, i)) {
        state.resources.cash -= unitUnlockCost(def, i);
        u.unlocked = true;
        u.level = 1;
        return true;
      }
    }
  }
  // 2) 매니저 (자동화가 핵심)
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    for (let i = 0; i < def.units.length; i++) {
      const u = state.businesses[def.id].units[i];
      if (u.unlocked && !u.manager && state.resources.cash >= managerCost(def, i)) {
        state.resources.cash -= managerCost(def, i);
        u.manager = true;
        return true;
      }
    }
  }
  // 3) 엘리베이터 (전 유닛 배율)
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    const bs = state.businesses[def.id];
    if (bs.hoistLevel < HOIST_LEVELS.length && state.resources.cash >= hoistCost(state, def.id) * 3) {
      state.resources.cash -= hoistCost(state, def.id);
      bs.hoistLevel += 1;
      return true;
    }
  }
  // 4) 초당 수익 증가 / 비용 이 최대인 레벨업
  let best: { def: (typeof BUSINESSES)[number]; i: number; cost: number; score: number } | null = null;
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    for (let i = 0; i < def.units.length; i++) {
      const u = state.businesses[def.id].units[i];
      if (!u.unlocked) continue;
      const cost = unitCost(state, def, i, 1);
      if (cost > state.resources.cash) continue;
      const before = outputPerCycle(state, def, i, 0) / cycleTime(state, def, i);
      u.level += 1;
      const after = outputPerCycle(state, def, i, 0) / cycleTime(state, def, i);
      u.level -= 1;
      const score = ((after - before) * def.price) / cost;
      if (score > 0 && (!best || score > best.score)) best = { def, i, cost, score };
    }
  }
  if (best) {
    state.resources.cash -= best.cost;
    state.businesses[best.def.id].units[best.i].level += 1;
    return true;
  }
  return false;
}

/** 시설: 부족한 쪽부터 */
function facilityStep(): void {
  const cs = cityStats(state);
  const order: string[] = [];
  if (cs.laborSupply < cs.popDemand) order.push('housing', 'hospital');
  if (cs.powerEff < 1) order.push('power');
  order.push('school', 'shops', 'road', 'green', 'fire', 'police', 'housing', 'power');
  for (const fid of order) {
    const def = FACILITIES.find((f) => f.id === fid);
    if (!def || !facilityUnlocked(state, def.id)) continue;
    if (facilityLevel(state, def.id) >= def.maxLevel) continue;
    if (state.resources.cash >= facilityCost(state, def.id)) {
      buyFacility(state, def.id);
      return;
    }
  }
}

/**
 * 세션 모델 — 기획서 9장: 세션 길이 3~7분, 하루 3~5회.
 * 세션 사이에는 오프라인 수익만 쌓인다(상한 적용). 이래야 실제 플레이를 예측한다.
 */
const SESSION_HOURS = [8, 12, 18, 22];
const FIRST_DAY_HOURS = [0, 1, 8, 12, 18, 22];
const SESSION_SECONDS = 6 * 60;
const total = days * 86400;
const dtActive = 1;
let lastOnline = 0;

function mark(): void {
  for (const def of applyCityLevelUps(state)) marks.push(`  ${def.icon} ${def.name.padEnd(5)} 해금 @ ${formatDuration(t)}`);
  if (!seen.has(state.city.level)) {
    seen.add(state.city.level);
    marks.push(
      `  도시 Lv.${String(state.city.level).padStart(2)} @ ${formatDuration(t).padEnd(12)} 초당 ${formatNumber(totalCashPerSecond(state, 0))}  — ${cityUnlockText(state.city.level)}`,
    );
  }
}

for (let day = 0; day < days; day++) {
  for (const hour of day === 0 ? FIRST_DAY_HOURS : SESSION_HOURS) {
    const startAt = day * 86400 + hour * 3600;
    if (startAt > total) break;
    // 오프라인 수익 정산
    const away = startAt - lastOnline;
    if (away > 0) computeOffline(state, away, 0);
    t = startAt;
    mark();
    // 세션: 탭 + 구매
    for (let s2 = 0; s2 < SESSION_SECONDS; s2 += dtActive) {
      for (const def of BUSINESSES) {
        for (const u of state.businesses[def.id].units) if (u.unlocked && !u.manager && !u.equip) u.running = true;
      }
      tickBusinesses(state, dtActive, 0);
      if (s2 % 10 === 0) for (let k = 0; k < 20; k++) if (!buyStep()) break;
      if (s2 % 30 === 0) facilityStep();
      t += dtActive;
      mark();
    }
    lastOnline = t;
  }
}

const cs = cityStats(state);
console.log(`\n=== ${days}일 시뮬레이션 ===`);
console.log(marks.join('\n'));
console.log(`\n누적 세수  : ${formatNumber(state.city.taxRun)}`);
console.log(`초당 수익  : ${formatNumber(totalCashPerSecond(state, 0))}`);
console.log(`물자       : ${formatNumber(state.resources.material)}`);
console.log(`재개발 설계도: ${blueprintsOnPrestige(state)}  (가능 ${state.city.taxRun >= CONFIG.prestige.minTax})`);
console.log(`\n도시`);
console.log(`  인구 ${formatNumber(state.city.pop)} / 상한 ${formatNumber(cs.popCap)}  · 필요 ${formatNumber(cs.popDemand)}`);
console.log(`  전력 ${formatNumber(cs.powerSupply)} / ${formatNumber(cs.powerDemand)} (${Math.round(cs.powerEff * 100)}%)`);
console.log(`  세수 x${cs.taxMult.toFixed(2)} · 산출 x${cs.outputMult.toFixed(2)} · 운반 ${cs.transferDelay.toFixed(0)}초`);
console.log(`  시설: ${FACILITIES.filter((f) => facilityLevel(state, f.id) > 0).map((f) => `${f.name}${facilityLevel(state, f.id)}`).join(' ') || '없음'}`);
console.log(`\n사업`);
for (const def of BUSINESSES) {
  if (!isUnlocked(state, def)) continue;
  const r = businessRatePerSecond(state, def, 0);
  const eff = projectedEfficiency(state, def, 0);
  const lv = state.businesses[def.id].units.map((u) => (u.unlocked ? u.level : '-')).join('/');
  console.log(
    `  ${def.icon} ${def.name.padEnd(5)} ${formatNumber(r.cash * eff).padStart(10)}/s  가동 ${staffed(state, def.id)}/${state.businesses[def.id].units.filter((u) => u.unlocked).length}  엘리베이터 Lv.${state.businesses[def.id].hoistLevel}`,
  );
  console.log(`      레벨 ${lv}`);
}
console.log(`\n도시 레벨 요구 (참고)`);
for (const L of [3, 6, 10, 12, 15]) console.log(`  Lv.${L}: 세수 ${formatNumber(cityRequirement(L))}`);
