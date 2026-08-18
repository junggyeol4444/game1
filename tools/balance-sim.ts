/**
 * 밸런스 시뮬레이터.
 * 탐욕적(비용 대비 초당 수익 증가량이 가장 큰 것부터) 구매 AI로 진행 속도를 측정한다.
 * 실행: npm run sim  [-- --days 30]
 */
import { BUSINESSES } from '../src/data/businesses';
import { CONFIG } from '../src/data/config';
import {
  businessRatePerSecond,
  cycleTime,
  isUnlocked,
  managerCost,
  outputPerCycle,
  projectedEfficiency,
  tickBusinesses,
  totalCashPerSecond,
  unitCost,
} from '../src/core/economy';
import { applyCityLevelUps, blueprintsOnPrestige, cumulativeTaxForLevel } from '../src/core/progression';
import { createInitialState } from '../src/core/state';
import { formatDuration, formatNumber } from '../src/core/num';

const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 30;

const state = createInitialState(0);
let t = 0;
const dt = 2;
const marks: string[] = [];
const seenLevel = new Set<number>([1]);

function buyStep(now: number) {
  // 1) 매니저 우선 (자동화가 방치형의 핵심 가치)
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    const bs = state.businesses[def.id];
    for (let i = 0; i < def.units.length; i++) {
      const u = bs.units[i];
      if (u.level > 0 && !u.manager && state.resources.cash >= managerCost(def, i)) {
        state.resources.cash -= managerCost(def, i);
        u.manager = true;
      }
    }
  }
  // 2) 초당 수익 증가량 / 비용 이 최대인 유닛 1레벨 구매
  let best: { def: (typeof BUSINESSES)[number]; i: number; cost: number; score: number } | null = null;
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    for (let i = 0; i < def.units.length; i++) {
      const cost = unitCost(state, def, i, 1);
      if (cost > state.resources.cash) continue;
      const u = state.businesses[def.id].units[i];
      const before = u.level > 0 ? outputPerCycle(state, def, i, now) / cycleTime(state, def, i) : 0;
      u.level += 1;
      const after = outputPerCycle(state, def, i, now) / cycleTime(state, def, i);
      u.level -= 1;
      const gain = (after - before) * def.price;
      const score = gain / cost;
      if (score > 0 && (!best || score > best.score)) best = { def, i, cost, score };
    }
  }
  if (best) {
    state.resources.cash -= best.cost;
    state.businesses[best.def.id].units[best.i].level += 1;
  }
}

const total = days * 86400;
while (t < total) {
  // 플레이어가 초반에 수동으로 탭하는 것을 근사
  for (const def of BUSINESSES) {
    for (const u of state.businesses[def.id].units) if (u.level > 0 && !u.manager) u.running = true;
  }
  tickBusinesses(state, dt, 0);
  const unlocked = applyCityLevelUps(state);
  for (const def of unlocked) marks.push(`  ${def.icon} ${def.name.padEnd(6)} 해금  @ ${formatDuration(t)}`);
  if (!seenLevel.has(state.city.level)) {
    seenLevel.add(state.city.level);
    if (state.city.level % 2 === 0 || state.city.level <= 6)
      marks.push(
        `  도시 Lv.${String(state.city.level).padStart(2)}      @ ${formatDuration(t)}  (초당 ${formatNumber(totalCashPerSecond(state, 0))})`,
      );
  }
  if (t % 60 === 0) for (let k = 0; k < 30; k++) buyStep(0);
  t += dt;
}

console.log(`\n=== ${days}일 시뮬레이션 ===`);
console.log(marks.join('\n'));
console.log(`\n최종 도시 레벨: ${state.city.level} / ${CONFIG.cityLevel.max}`);
console.log(`누적 수익      : ${formatNumber(state.stats.cashEarnedRun)}`);
console.log(`초당 수익      : ${formatNumber(totalCashPerSecond(state, 0))}`);
console.log(`재개발 설계도  : ${blueprintsOnPrestige(state)}`);
console.log(`\n사업별 초당 산출`);
for (const def of BUSINESSES) {
  if (!isUnlocked(state, def)) continue;
  const r = businessRatePerSecond(state, def, 0);
  const levels = state.businesses[def.id].units.map((u) => u.level).join('/');
  const eff = Math.round(projectedEfficiency(state, def, 0) * 100);
  console.log(`  ${def.icon} ${def.name.padEnd(6)} ${formatNumber(r.cash).padStart(10)}/s  가동률 ${String(eff).padStart(3)}%  레벨 ${levels}`);
}
console.log(`\n도시 레벨 요구 누적세수 (참고)`);
for (const L of [3, 6, 10, 14, 16, 20]) {
  console.log(`  Lv.${L}: ${formatNumber(cumulativeTaxForLevel(L))} 세수 = ${formatNumber(cumulativeTaxForLevel(L) / CONFIG.taxRate)} 누적수익`);
}
