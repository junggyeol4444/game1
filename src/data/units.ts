/**
 * 유닛 사다리 (기획서 '수치 표' 2장 · 3장).
 * 광산 12층 표를 레퍼런스로 두고, 다른 사업은 1번 유닛 기준값으로 스케일한다.
 */
export interface LadderRow {
  /** 해금 비용 (1번 유닛은 0) */
  unlock: number;
  /** 업그레이드 base_cost */
  base: number;
  rate: number;
  baseOut: number;
  cycle: number;
}

export const MINE_LADDER: LadderRow[] = [
  { unlock: 0, base: 4, rate: 1.07, baseOut: 1, cycle: 0.6 },
  { unlock: 60, base: 60, rate: 1.15, baseOut: 60, cycle: 3 },
  { unlock: 720, base: 720, rate: 1.14, baseOut: 540, cycle: 6 },
  { unlock: 8_640, base: 8_640, rate: 1.13, baseOut: 4_320, cycle: 12 },
  { unlock: 103_680, base: 103_680, rate: 1.12, baseOut: 51_840, cycle: 24 },
  { unlock: 1_244_160, base: 1_244_160, rate: 1.11, baseOut: 622_080, cycle: 48 },
  { unlock: 14_929_920, base: 14_929_920, rate: 1.1, baseOut: 7_464_960, cycle: 96 },
  { unlock: 179_159_040, base: 179_159_040, rate: 1.09, baseOut: 89_579_520, cycle: 192 },
  { unlock: 2_149_908_480, base: 2_149_908_480, rate: 1.08, baseOut: 1_074_954_240, cycle: 384 },
  { unlock: 25_798_901_760, base: 25_798_901_760, rate: 1.08, baseOut: 12_899_450_880, cycle: 768 },
  { unlock: 309_586_821_120, base: 309_586_821_120, rate: 1.07, baseOut: 154_793_410_560, cycle: 1536 },
  { unlock: 3_715_041_853_440, base: 3_715_041_853_440, rate: 1.07, baseOut: 1_857_520_926_720, cycle: 3072 },
];

/** 매니저 비용 = 해금비용 x 5 (1층은 업그레이드 base 기준) */
export function managerCostOf(row: LadderRow): number {
  return Math.max(row.unlock, row.base) * 5;
}

/** 전 유닛 공통 배율 장치 (광산의 엘리베이터). 비용 배수 x50 */
export const HOIST_LEVELS: { cost: number; mult: number }[] = [
  { cost: 0, mult: 1 },
  { cost: 500, mult: 1.5 },
  { cost: 25_000, mult: 2 },
  { cost: 1_200_000, mult: 3 },
  { cost: 60_000_000, mult: 4.5 },
  { cost: 3_000_000_000, mult: 7 },
  { cost: 150_000_000_000, mult: 11 },
  { cost: 7_500_000_000_000, mult: 17 },
];

/** 광산 층별 지층 (2개 층마다 바뀜) */
export interface Strata {
  name: string;
  rock: string;
  rockDark: string;
  ore: string;
  oreName: string;
}

export const MINE_STRATA: Strata[] = [
  { name: '흙층', rock: '#A98058', rockDark: '#8B6746', ore: '#3E3A38', oreName: '석탄' },
  { name: '암반층', rock: '#9AA0A6', rockDark: '#7D838A', ore: '#B7C3CC', oreName: '철광석' },
  { name: '적색 암반', rock: '#B5715C', rockDark: '#95594A', ore: '#E08A4B', oreName: '구리' },
  { name: '청색 암반', rock: '#7C93AD', rockDark: '#63788E', ore: '#DDE7F0', oreName: '은' },
  { name: '흑색 암반', rock: '#5A5550', rockDark: '#454039', ore: '#FFC845', oreName: '금' },
  { name: '결정층', rock: '#8E7BB5', rockDark: '#725F99', ore: '#B0E8FF', oreName: '보석 원석' },
];

export function strataOf(floorIndex: number): Strata {
  return MINE_STRATA[Math.min(MINE_STRATA.length - 1, Math.floor(floorIndex / 2))];
}

/** 마일스톤 도달 시 교체되는 장비 (기획서 광산 상세 4장) */
export const EQUIPMENT: Record<string, string[]> = {
  mine: ['곡괭이', '착암기', '소형 드릴', '대형 드릴', '굴착기', '자동 굴착기', '레이저 절삭기', '대형 채굴 로봇', '전자동 채굴 플랜트'],
  factory: ['수공구', '전동 공구', '컨베이어', '자동 프레스', '산업 로봇', '협동 로봇', '무인 셀', 'AI 공정', '전자동 팩토리'],
  fishery: ['손낚시', '통발', '자망', '트롤망', '음탐기', '자동 양망기', '무인 어선', '해저 채취기', '해양 목장 시스템'],
  park: ['간이 놀이기구', '전동 어트랙션', '대형 어트랙션', '스릴 라이드', '4D 라이드', 'VR 라이드', '자기부상 라이드', '홀로그램 쇼', '테마 랜드'],
  corp: ['수기 장부', '전산 시스템', 'ERP', '데이터 분석', 'AI 예측', '자동 트레이딩', '글로벌 네트워크', '양자 연산', '자율 경영 시스템'],
};

/** 유닛 레벨 -> 장비 단계 (마일스톤 지점과 동일) */
export const EQUIP_LEVELS = [0, 10, 25, 50, 100, 200, 400, 800, 1600];

export function equipmentTier(level: number): number {
  let t = 0;
  for (let i = 0; i < EQUIP_LEVELS.length; i++) if (level >= EQUIP_LEVELS[i]) t = i;
  return t;
}

/** 작업자 수: Lv 1/10/25/50/100 -> 1/2/3/4/5명 */
export function workerCount(level: number): number {
  if (level <= 0) return 0;
  if (level >= 100) return 5;
  if (level >= 50) return 4;
  if (level >= 25) return 3;
  if (level >= 10) return 2;
  return 1;
}
