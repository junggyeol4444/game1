import { FAC_COLOR } from './palette';
import type { BusinessId } from '../core/types';

export type FacilityId =
  | 'housing'
  | 'shops'
  | 'hospital'
  | 'school'
  | 'fire'
  | 'police'
  | 'green'
  | 'power'
  | 'road';

export type BuildingId = BusinessId | FacilityId;

/**
 * 시설 (기획서 수치표 4장).
 * 산출이 없고 배율만 준다. 레벨 0 = 미건설, 1 이상 = 건설됨.
 */
export interface FacilityDef {
  id: FacilityId;
  name: string;
  icon: string;
  color: string;
  unlockCityLevel: number;
  baseCost: number;
  rate: number;
  /** 레벨당 효과량 */
  per: number;
  /** 효과 상한 (레벨 수) */
  maxLevel: number;
  seeing: string;
  effect: string;
  effectText: (level: number) => string;
  tiers: string[];
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export const FACILITIES: FacilityDef[] = [
  {
    id: 'housing',
    name: '주거지',
    icon: '🏠',
    color: FAC_COLOR.housing,
    unlockCityLevel: 1,
    baseCost: 100,
    rate: 1.12,
    per: 50,
    maxLevel: 9999,
    seeing: '아파트 단지. 창문에 불이 켜지고 사람이 드나든다',
    effect: '인구 상한 — 사업 유닛을 돌릴 노동력',
    effectText: (l) => `인구 상한 ${l * 50}`,
    tiers: ['공터', '단독주택', '연립주택', '아파트', '고층 아파트단지'],
  },
  {
    id: 'shops',
    name: '상가',
    icon: '🏪',
    color: FAC_COLOR.shops,
    unlockCityLevel: 2,
    baseCost: 800,
    rate: 1.12,
    per: 0.02,
    maxLevel: 100,
    seeing: '상점가. 손님이 오가고 간판이 켜진다',
    effect: '세수 증가 — 도시 레벨업 가속',
    effectText: (l) => `세수 +${pct(Math.min(2, l * 0.02))}`,
    tiers: ['공터', '노점', '상가', '쇼핑몰', '백화점'],
  },
  {
    id: 'road',
    name: '도로',
    icon: '🛣️',
    color: FAC_COLOR.road,
    unlockCityLevel: 4,
    baseCost: 15_000,
    rate: 1.12,
    per: 0.03,
    maxLevel: 83,
    seeing: '도시 노선도. 차량 흐름',
    effect: '운반 속도 — 사업 간 자원 이동 지연 감소',
    effectText: (l) => `운반 지연 -${pct(Math.min(0.75, l * 0.03))}`,
    tiers: ['흙길', '포장도로', '왕복 4차선', '고가도로', '입체 교차로'],
  },
  {
    id: 'power',
    name: '발전소',
    icon: '⚡',
    color: FAC_COLOR.power,
    unlockCityLevel: 5,
    baseCost: 20_000,
    rate: 1.11,
    per: 100,
    maxLevel: 9999,
    seeing: '발전기가 돌아간다. 전력 게이지',
    effect: '전력 공급 — 모자라면 초당 산출이 비례해 깎인다',
    effectText: (l) => `전력 ${l * 100}`,
    tiers: ['공터', '화력발전소', '수력발전(댐)', '원자력발전소', '신재생 단지'],
  },
  {
    id: 'school',
    name: '학교',
    icon: '🏫',
    color: FAC_COLOR.school,
    unlockCityLevel: 7,
    baseCost: 12_000,
    rate: 1.13,
    per: 0.02,
    maxLevel: 100,
    seeing: '교실. 학생이 수업 중',
    effect: '작업 효율 — 전 사업 산출 증가',
    effectText: (l) => `전 사업 산출 +${pct(Math.min(2, l * 0.02))}`,
    tiers: ['공터', '분교', '학교', '고등학교', '대학교'],
  },
  {
    id: 'hospital',
    name: '병원',
    icon: '🏥',
    color: FAC_COLOR.hospital,
    unlockCityLevel: 8,
    baseCost: 5_000,
    rate: 1.13,
    per: 0.03,
    maxLevel: 50,
    seeing: '병동 단면. 병상과 출동하는 구급차',
    effect: '회복 속도 — 인구 1명이 내는 노동력 증가',
    effectText: (l) => `노동력 +${pct(Math.min(1.5, l * 0.03))}`,
    tiers: ['공터', '의원', '병원', '종합병원', '대학병원'],
  },
  {
    id: 'green',
    name: '공원',
    icon: '🌳',
    color: FAC_COLOR.green,
    unlockCityLevel: 9,
    baseCost: 8_000,
    rate: 1.12,
    per: 0.02,
    maxLevel: 75,
    seeing: '조경. 시민이 산책하고 분수가 작동한다',
    effect: '만족도 — 인구 유입 속도',
    effectText: (l) => `인구 유입 +${pct(Math.min(1.5, l * 0.02))}`,
    tiers: ['공터', '쌈지공원', '근린공원', '체육공원', '대공원'],
  },
  {
    id: 'fire',
    name: '소방서',
    icon: '🚒',
    color: FAC_COLOR.fire,
    unlockCityLevel: 11,
    baseCost: 30_000,
    rate: 1.14,
    per: 0.015,
    maxLevel: 50,
    seeing: '차고에 소방차가 대기한다. 출동 시 사이렌',
    effect: '사고율 감소 — 화재가 나면 그 사업이 절반만 돈다',
    effectText: (l) => `사고율 -${pct(Math.min(0.75, l * 0.015))}`,
    tiers: ['공터', '119 안전센터', '소방서', '소방본부', '광역 재난본부'],
  },
  {
    id: 'police',
    name: '경찰서',
    icon: '👮',
    color: FAC_COLOR.police,
    unlockCityLevel: 12,
    baseCost: 50_000,
    rate: 1.14,
    per: 0.02,
    maxLevel: 45,
    seeing: '순찰 배치도. 순찰차가 도시를 돈다',
    effect: '손실 방지 — 도난을 막는다',
    effectText: (l) => `손실 방지 ${pct(Math.min(0.9, l * 0.02))}`,
    tiers: ['공터', '파출소', '지구대', '경찰서', '지방청'],
  },
];

export const FACILITY_BY_ID = Object.fromEntries(FACILITIES.map((f) => [f.id, f])) as Record<
  FacilityId,
  FacilityDef
>;
export const FACILITY_IDS = FACILITIES.map((f) => f.id);
export function isFacilityId(id: string): id is FacilityId {
  return id in FACILITY_BY_ID;
}

/** 시설 외형 단계 기준 레벨 */
export const FAC_TIER_LEVELS = [0, 1, 15, 40, 80];
export function facilityTierOf(level: number): number {
  let t = 0;
  for (let i = 0; i < FAC_TIER_LEVELS.length; i++) if (level >= FAC_TIER_LEVELS[i]) t = i;
  return t;
}

/** 사업 외형 단계 (총 유닛 레벨 합 기준, 기획서 광산 상세 5장) */
export const BIZ_TIER_LEVELS = [0, 1, 51, 201, 501, 1001, 2501];
export function businessTierOf(totalLevel: number): number {
  let t = 0;
  for (let i = 0; i < BIZ_TIER_LEVELS.length; i++) if (totalLevel >= BIZ_TIER_LEVELS[i]) t = i;
  return t;
}

export const BUSINESS_TIERS: Record<BusinessId, string[]> = {
  mine: ['빈 터', '갱도 입구', '채굴탑', '채굴장', '대형 채굴장', '광산단지', '광산도시'],
  factory: ['빈 터', '작업장', '소형 공장', '중형 공장', '대형 공장', '공업단지', '스마트 시티팩토리'],
  fishery: ['빈 터', '나루터', '어항', '트롤 선단', '원양 기지', '수산 단지', '해양 도시'],
  park: ['빈 터', '간이 놀이터', '소형 유원지', '놀이공원', '대형 놀이공원', '테마파크', '테마 리조트'],
  corp: ['빈 터', '사무소', '사옥', '빌딩', '고층 빌딩', '마천루', '기업 도시'],
};

/**
 * 도시 레벨 (기획서 수치표 5장). 누적 세수 요구량, 배수 x8.
 */
export const CITY_LEVELS: { req: number; unlocks: string }[] = [
  { req: 0, unlocks: '광산 · 주거지' },
  { req: 5_000, unlocks: '상가' },
  { req: 50_000, unlocks: '공장' },
  { req: 400_000, unlocks: '도로' },
  { req: 3_000_000, unlocks: '발전소' },
  { req: 25_000_000, unlocks: '어항' },
  { req: 200_000_000, unlocks: '학교' },
  { req: 1_600_000_000, unlocks: '병원' },
  { req: 13_000_000_000, unlocks: '공원' },
  { req: 100_000_000_000, unlocks: '놀이공원' },
  { req: 800_000_000_000, unlocks: '소방서' },
  { req: 6_400_000_000_000, unlocks: '경찰서' },
  { req: 50_000_000_000_000, unlocks: '(확장) 농장' },
  { req: 400_000_000_000_000, unlocks: '(확장) 채석장' },
  { req: 3_200_000_000_000_000, unlocks: '기업' },
  { req: 26_000_000_000_000_000, unlocks: '(확장) 무역항' },
];

export const MAX_CITY_LEVEL = 60;

/**
 * 도시 레벨 L 에 도달하는 데 필요한 누적 세수.
 *
 * 수치표의 배수 x8 을 그대로 쓰면 수입 곡선이 훨씬 빨라서 16레벨이 1시간에 전부 소모된다
 * (시뮬레이터 측정). 수치표가 "측정 후 조정" 전제이므로, 같은 문서 9장의 밸런싱 목표치
 * (1일차 Lv5~6 · 3일차 Lv8~9)에 맞도록 Lv.3 이후 배수를 올렸다.
 */
export const CITY_REQ_GROWTH = 78;

export function cityRequirement(level: number): number {
  if (level <= 1) return 0;
  const i = level - 1;
  if (i <= 2) return CITY_LEVELS[i].req;
  return CITY_LEVELS[2].req * Math.pow(CITY_REQ_GROWTH, level - 3);
}

export function cityUnlockText(level: number): string {
  const i = level - 1;
  return i < CITY_LEVELS.length ? CITY_LEVELS[i].unlocks : '신규 구역';
}

/**
 * 도시 발전 단계 (아트 스타일 7장).
 * 단계 이름은 문명 시대마다 다르다 — data/eras.ts 의 settlement 를 쓴다.
 */
export function terrainStage(level: number): number {
  if (level >= 13) return 4;
  if (level >= 10) return 3;
  if (level >= 6) return 2;
  if (level >= 3) return 1;
  return 0;
}

// ── 아이소메트릭 타일 배치 ────────────────────────────────
// 건물은 2x2 타일. 블록 사이 1타일이 도로.

export interface Lot {
  gx: number;
  gy: number;
  w: number;
  h: number;
}

export const GRID = { cols: 10, rows: 16 };

const blockX = (c: number) => 1 + c * 3;
const blockY = (r: number) => 1 + r * 3;

export const LOTS: Record<BuildingId, Lot> = {
  mine: { gx: blockX(0), gy: blockY(0), w: 2, h: 2 },
  power: { gx: blockX(1), gy: blockY(0), w: 2, h: 2 },
  factory: { gx: blockX(2), gy: blockY(0), w: 2, h: 2 },

  housing: { gx: blockX(0), gy: blockY(1), w: 2, h: 2 },
  school: { gx: blockX(1), gy: blockY(1), w: 2, h: 2 },
  hospital: { gx: blockX(2), gy: blockY(1), w: 2, h: 2 },

  shops: { gx: blockX(0), gy: blockY(2), w: 2, h: 2 },
  road: { gx: blockX(1), gy: blockY(2), w: 2, h: 2 },
  police: { gx: blockX(2), gy: blockY(2), w: 2, h: 2 },

  fire: { gx: blockX(0), gy: blockY(3), w: 2, h: 2 },
  green: { gx: blockX(1), gy: blockY(3), w: 2, h: 2 },
  park: { gx: blockX(2), gy: blockY(3), w: 2, h: 2 },

  corp: { gx: blockX(0), gy: blockY(4), w: 2, h: 2 },
  fishery: { gx: blockX(2), gy: blockY(4), w: 2, h: 2 },
};

/** 물 타일 (항구 쪽) */
export function isWaterTile(_gx: number, gy: number): boolean {
  return gy >= GRID.rows - 1;
}

export function isRoadTile(gx: number, gy: number): boolean {
  if (isWaterTile(gx, gy)) return false;
  return gx % 3 === 0 || gy % 3 === 0;
}
