/**
 * 문명 시대 진행.
 *
 * 이 게임의 장기 루프는 "재개발"이 아니라 **문명 전환**이다.
 * 빈 들판 + 움집에서 시작해 목표 세수에 닿으면 도시를 전부 허물고 다음 문명으로 넘어간다.
 * 전환은 완전 초기화다 — 시대 자체는 산출 보너스를 주지 않는다.
 * 오히려 넘어갈수록 비용(costMult)과 사이클(cycleMult)이 올라간다.
 * 진행을 되돌려 주는 건 유산(영구 재화) 강화뿐이다.
 */
import { cityRequirement, terrainStage, type FacilityId } from '../data/buildings';
import { CONFIG } from '../data/config';
import { ERAS, MAX_ERA, eraDef, settlementNameOf, type EraDef, type EraPalette } from '../data/eras';
import type { BusinessId, GameState } from './types';
import { BUSINESS_BY_ID, RESOURCE_META } from '../data/businesses';
import { fill } from './ko';

export { LEGACY } from '../data/eras';
export { MAX_ERA } from '../data/eras';

export function eraIndex(state: GameState): number {
  return Math.max(0, Math.min(MAX_ERA, state.era ?? 0));
}

export function currentEra(state: GameState): EraDef {
  return eraDef(eraIndex(state));
}

/** 다음 문명. 마지막 시대에서는 자기 자신 (같은 시대를 다시 세운다) */
export function nextEra(state: GameState): EraDef {
  return eraDef(Math.min(MAX_ERA, eraIndex(state) + 1));
}

export function isFinalEra(state: GameState): boolean {
  return eraIndex(state) >= MAX_ERA;
}

export function eraPalette(state: GameState): EraPalette {
  return currentEra(state).palette;
}

/**
 * 이 시대의 비용 배율. 문명 전환은 완전 초기화라 산출 보너스가 없다 —
 * 대신 넘어갈수록 모든 게 비싸진다. 진행을 되돌려 주는 건 유산 강화뿐이다.
 */
export function eraCostMult(state: GameState): number {
  return currentEra(state).costMult;
}

/** 이 시대의 사이클 시간 배율. 넘어갈수록 한 사이클이 느려진다 */
export function eraCycleMult(state: GameState): number {
  return currentEra(state).cycleMult;
}

// ── 이름 ────────────────────────────────────────────────────
export function bizName(state: GameState, id: BusinessId): string {
  return currentEra(state).business[id].name;
}
export function bizIcon(state: GameState, id: BusinessId): string {
  return currentEra(state).business[id].icon;
}
export function bizUnitLabel(state: GameState, id: BusinessId): string {
  return currentEra(state).business[id].unitLabel;
}
export function bizHoistName(state: GameState, id: BusinessId): string {
  return currentEra(state).hoist[id];
}
/**
 * 유닛(광산의 '층') 표시 이름.
 * businesses.ts 에 적힌 '3층 철광 갱도' 같은 이름은 근대 이후 도시를 전제로 쓴 것이라,
 * 그 이전 문명에서는 시대 단위 이름으로 부른다 ('3번 채취터').
 */
const NAMED_FROM_ERA = 6; // 근대

export function unitDisplayName(state: GameState, id: BusinessId, index: number, written: string): string {
  if (eraIndex(state) >= NAMED_FROM_ERA) return written;
  return `${index + 1}번 ${bizUnitLabel(state, id)}`;
}

/** 매니저 이름도 같은 이유로 근대 이전에는 시대에 맞는 호칭으로 부른다 */
export function unitManagerName(state: GameState, id: BusinessId, index: number, written: string): string {
  if (eraIndex(state) >= NAMED_FROM_ERA) return written;
  return `${index + 1}번 ${bizUnitLabel(state, id)} 일꾼`;
}

/**
 * 외형 단계 이름.
 *
 * businesses.ts / buildings.ts 에 적힌 '갱도 입구 -> 채굴탑' 같은 이름은 근대 도시를
 * 전제로 쓴 것이다. 석기 시대 '돌 채취장'에 붙으면 말이 안 된다.
 * 그 이전 문명에서는 시대 건물 이름에 규모 사다리를 붙여 부른다.
 * (9시대 x 건물 14종 x 단계 = 600줄을 손으로 쓰는 대신)
 */
const BIZ_LADDER = ['작은 %s', '%s', '큰 %s', '대형 %s', '%s 단지', '%s 대단지'];
const FAC_LADDER = ['작은 %s', '%s', '큰 %s', '%s 단지'];

/**
 * 시대 이름에 이미 크기 말이 붙어 있으면 뗀다.
 * '큰 모닥불' 에 사다리를 그냥 붙이면 '작은 큰 모닥불' 이 된다.
 */
const SIZE_PREFIX = ['큰 ', '작은 ', '대형 ', '소형 ', '거대 '];
function baseName(name: string): string {
  for (const p of SIZE_PREFIX) if (name.startsWith(p) && name.length > p.length + 1) return name.slice(p.length);
  return name;
}

export function tierLabelOf(era: number, name: string, tier: number, written: string[], facility: boolean): string {
  if (tier <= 0) return written[0] ?? '빈 터';
  if (era >= NAMED_FROM_ERA) return written[tier] ?? name;
  const ladder = facility ? FAC_LADDER : BIZ_LADDER;
  const pat = ladder[Math.min(tier, ladder.length) - 1];
  return pat.replace(/%s/g, baseName(name));
}

/** 자원 이름도 시대를 탄다 — 석기 시대에 '관광객'이 오지는 않는다 */
export function resourceName(state: GameState, id: string): string {
  const r = currentEra(state).resource as Record<string, string | undefined>;
  return r[id] ?? RESOURCE_META[id]?.name ?? id;
}

/** `{ore|을} 캔다` 같은 자막을 이 시대 자원 이름으로 채운다 */
export function bizSubtitle(state: GameState, id: BusinessId): string {
  return fill(BUSINESS_BY_ID[id].subtitle, (key) => resourceName(state, key));
}

export function facName(state: GameState, id: FacilityId): string {
  return currentEra(state).facility[id].name;
}
export function facIcon(state: GameState, id: FacilityId): string {
  return currentEra(state).facility[id].icon;
}
/** 도시 규모 이름 — 석기 시대의 '큰 부족' ~ 우주 시대의 '성간 도시' */
export function settlementName(state: GameState): string {
  return settlementNameOf(eraIndex(state), terrainStage(state.city.level));
}
/**
 * 도감 키. 문명마다 같은 부지에 다른 건물이 서므로 시대를 키에 넣는다.
 * 이게 이 게임의 장기 수집 메타다 — 9개 문명 x 건물 14종 x 외형 단계.
 */
export function seenKey(eraId: string, buildingId: string): string {
  return `${eraId}:${buildingId}`;
}

export function leaderTitle(state: GameState): string {
  return currentEra(state).leader;
}

// ── 전환 조건 ───────────────────────────────────────────────
/** 지금 문명을 졸업하려면 도달해야 하는 도시 레벨 */
export function eraTargetLevel(state: GameState): number {
  const i = eraIndex(state);
  // 마지막 시대 이후로는 같은 시대를 더 크게 다시 세운다 — 목표 레벨만 계속 오른다
  const repeats = i >= MAX_ERA ? Math.max(0, state.prestige.count - MAX_ERA) : 0;
  return ERAS[i].advanceLevel + repeats * CONFIG.era.repeatLevels;
}

/** 지금 문명을 졸업하는 데 필요한 이번 회차 누적 세수 */
export function eraThreshold(state: GameState): number {
  return cityRequirement(eraTargetLevel(state));
}

export function eraProgress(state: GameState): { current: number; need: number; ratio: number } {
  const need = eraThreshold(state);
  const current = Math.max(0, state.city.taxRun);
  return { current, need, ratio: Math.min(1, current / need) };
}

export function canAdvanceEra(state: GameState): boolean {
  return state.city.taxRun >= eraThreshold(state);
}

/**
 * 전환으로 얻는 유산.
 * 시대가 오를수록 한 회차가 길어지므로 획득량도 시대마다 x2 로 커진다
 * (유산 강화 비용이 구매마다 x1.5 라, 이래야 강화 레벨이 계속 올라간다).
 * 목표를 넘겨서 더 키운 뒤 넘어가면 sqrt 만큼 더 받는다 — 이득이지만 완만하다.
 */
export function legacyOnAdvance(state: GameState): number {
  const need = eraThreshold(state);
  if (need <= 0) return 0;
  const ratio = Math.max(0, state.city.taxRun) / need;
  if (ratio < 1) return 0;
  const steps = (eraTargetLevel(state) - ERAS[0].advanceLevel) / CONFIG.era.repeatLevels;
  const base = CONFIG.era.baseGain * Math.pow(CONFIG.era.gainGrowth, Math.max(0, steps));
  return Math.floor(base * Math.sqrt(ratio));
}
