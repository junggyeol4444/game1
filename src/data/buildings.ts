import type { BusinessId } from '../core/types';

/** 시설 건물 (도시 능력치를 올린다) */
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

/** 시설 업그레이드 트랙 (시설당 3개) */
export interface FacilityTrack {
  id: string;
  name: string;
  /** 1레벨 비용 */
  baseCash: number;
  baseMat: number;
  growth: number;
  maxLevel: number;
  /** 레벨당 효과 배율/증가량 — 해석은 facilities.ts */
  per: number;
  /** 버튼에 뜨는 효과 문구 */
  effect: (level: number) => string;
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  icon: string;
  color: string;
  unlockCityLevel: number;
  /** 건설 비용 */
  buildCash: number;
  buildMat: number;
  /** 탭에서 보이는 것 */
  seeing: string;
  /** 효과 한 줄 */
  effect: string;
  tracks: [FacilityTrack, FacilityTrack, FacilityTrack];
  /** 마일스톤 외형 단계 (총 레벨 0 / 10 / 25 / 50 / 100) */
  tiers: string[];
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function track(
  id: string,
  name: string,
  baseCash: number,
  baseMat: number,
  per: number,
  effect: (l: number) => string,
  growth = 1.16,
  maxLevel = 200,
): FacilityTrack {
  return { id, name, baseCash, baseMat, growth, maxLevel, per, effect };
}

export const FACILITIES: FacilityDef[] = [
  {
    id: 'housing',
    name: '주거지',
    icon: '🏠',
    color: '#e8b84b',
    unlockCityLevel: 2,
    buildCash: 400,
    buildMat: 40,
    seeing: '아파트 단지. 창문에 불이 켜지고 사람이 드나든다',
    effect: '인구 상한 증가 → 사업 노동력 공급',
    tracks: [
      track('floors', '층 증축', 300, 30, 1.22, (l) => `인구 상한 x${Math.pow(1.22, l).toFixed(2)}`),
      track('blocks', '동 추가', 900, 120, 1.34, (l) => `인구 상한 x${Math.pow(1.34, l).toFixed(2)}`, 1.22),
      track('interior', '내부 시설', 500, 50, 1.1, (l) => `인구 상한 x${Math.pow(1.1, l).toFixed(2)}`),
    ],
    tiers: ['공터', '단독주택', '연립주택', '아파트', '고층 아파트단지'],
  },
  {
    id: 'shops',
    name: '상가',
    icon: '🏪',
    color: '#f4978e',
    unlockCityLevel: 4,
    buildCash: 3_000,
    buildMat: 200,
    seeing: '상점가. 손님이 오가고 간판이 켜진다',
    effect: '세수 증가 → 도시 레벨업 가속',
    tracks: [
      track('stores', '점포 수', 2_000, 150, 0.035, (l) => `세수 +${pct(l * 0.035)}`, 1.16, 80),
      track('grade', '업종 등급', 5_000, 400, 0.05, (l) => `세수 +${pct(l * 0.05)}`, 1.19, 80),
      track('signs', '간판', 1_500, 100, 0.02, (l) => `세수 +${pct(l * 0.02)}`, 1.16, 80),
    ],
    tiers: ['공터', '노점', '상가', '쇼핑몰', '백화점'],
  },
  {
    id: 'power',
    name: '발전소',
    icon: '⚡',
    color: '#7ee0ff',
    unlockCityLevel: 5,
    buildCash: 8_000,
    buildMat: 600,
    seeing: '발전기가 돌아간다. 전력 게이지',
    effect: '사업 가동 상한 — 전력이 모자라면 전 사업이 느려진다',
    tracks: [
      track('gens', '발전기 수', 5_000, 500, 1.3, (l) => `공급 x${Math.pow(1.3, l).toFixed(2)}`),
      track('method', '발전 방식', 30_000, 3_000, 1.7, (l) => `공급 x${Math.pow(1.7, l).toFixed(2)}`, 1.9, 4),
      track('grid', '송전망', 9_000, 900, 1.14, (l) => `공급 x${Math.pow(1.14, l).toFixed(2)}`),
    ],
    tiers: ['공터', '화력발전소', '수력발전(댐)', '원자력발전소', '신재생 단지'],
  },
  {
    id: 'school',
    name: '학교',
    icon: '🏫',
    color: '#b8f2a0',
    unlockCityLevel: 7,
    buildCash: 40_000,
    buildMat: 2_500,
    seeing: '교실. 학생이 수업 중',
    effect: '전 사업 작업 효율 상승',
    tracks: [
      track('rooms', '교실 수', 30_000, 2_000, 0.04, (l) => `전 사업 산출 +${pct(l * 0.04)}`, 1.16, 80),
      track('labs', '교육 시설', 60_000, 5_000, 0.03, (l) => `전 사업 산출 +${pct(l * 0.03)}`, 1.16, 80),
      track('teachers', '교사', 120_000, 9_000, 0.05, (l) => `전 사업 산출 +${pct(l * 0.05)}`, 1.19, 80),
    ],
    tiers: ['공터', '분교', '학교', '고등학교', '대학교'],
  },
  {
    id: 'hospital',
    name: '병원',
    icon: '🏥',
    color: '#f87171',
    unlockCityLevel: 9,
    buildCash: 400_000,
    buildMat: 12_000,
    seeing: '병동 단면. 병상과 출동하는 구급차',
    effect: '노동력 회복 — 인구 1명이 내는 노동력이 커진다',
    tracks: [
      track('beds', '병상 수', 300_000, 10_000, 0.06, (l) => `노동력 +${pct(l * 0.06)}`),
      track('equip', '의료 장비', 700_000, 25_000, 0.08, (l) => `노동력 +${pct(l * 0.08)}`, 1.18),
      track('ambulance', '구급차', 400_000, 15_000, 0.04, (l) => `노동력 +${pct(l * 0.04)}`),
    ],
    tiers: ['공터', '의원', '병원', '종합병원', '대학병원'],
  },
  {
    id: 'road',
    name: '도로',
    icon: '🛣️',
    color: '#9aa6bd',
    unlockCityLevel: 11,
    buildCash: 3_000_000,
    buildMat: 80_000,
    seeing: '도시 노선도. 차량 흐름',
    effect: '자원 이동 속도 — 자원 사슬의 최소 가동률을 올린다',
    tracks: [
      track('lanes', '차선 확장', 2_000_000, 60_000, 0.02, (l) => `최소 가동률 +${pct(l * 0.02)}`, 1.2, 25),
      track('cross', '교차로', 5_000_000, 150_000, 0.03, (l) => `사슬 요구량 -${pct(1 - Math.pow(0.97, l))}`, 1.22, 25),
      track('signal', '신호 체계', 3_000_000, 90_000, 0.02, (l) => `오프라인 효율 +${pct(l * 0.02)}`, 1.2, 20),
    ],
    tiers: ['흙길', '포장도로', '왕복 4차선', '고가도로', '입체 교차로'],
  },
  {
    id: 'green',
    name: '공원',
    icon: '🌳',
    color: '#4ade80',
    unlockCityLevel: 13,
    buildCash: 20_000_000,
    buildMat: 400_000,
    seeing: '조경. 시민이 산책하고 분수가 작동한다',
    effect: '만족도 → 인구 유입 속도',
    tracks: [
      track('area', '면적', 15_000_000, 300_000, 0.25, (l) => `인구 유입 x${(1 + l * 0.25).toFixed(2)}`),
      track('deco', '조경물', 30_000_000, 700_000, 0.18, (l) => `인구 유입 x${(1 + l * 0.18).toFixed(2)}`),
      track('amenity', '편의시설', 25_000_000, 500_000, 0.12, (l) => `인구 유입 x${(1 + l * 0.12).toFixed(2)}`),
    ],
    tiers: ['공터', '쌈지공원', '근린공원', '체육공원', '대공원'],
  },
  {
    id: 'fire',
    name: '소방서',
    icon: '🚒',
    color: '#fb923c',
    unlockCityLevel: 15,
    buildCash: 300_000_000,
    buildMat: 4_000_000,
    seeing: '차고에 소방차가 대기한다. 출동 시 사이렌',
    effect: '화재 발생률 감소 — 화재 나면 그 사업이 절반만 돈다',
    tracks: [
      track('trucks', '소방차', 200_000_000, 3_000_000, 0.08, (l) => `화재 확률 -${pct(1 - Math.pow(0.92, l))}`, 1.2, 30),
      track('gear', '장비', 400_000_000, 6_000_000, 0.06, (l) => `진압 시간 -${pct(1 - Math.pow(0.94, l))}`, 1.2, 30),
      track('crew', '대원', 300_000_000, 5_000_000, 0.05, (l) => `피해량 -${pct(1 - Math.pow(0.95, l))}`, 1.2, 30),
    ],
    tiers: ['공터', '119 안전센터', '소방서', '소방본부', '광역 재난본부'],
  },
  {
    id: 'police',
    name: '경찰서',
    icon: '👮',
    color: '#5b8def',
    unlockCityLevel: 17,
    buildCash: 10_000_000_000,
    buildMat: 90_000_000,
    seeing: '순찰 배치도. 순찰차가 도시를 돈다',
    effect: '손실 방지 — 도난 이벤트를 막는다',
    tracks: [
      track('cars', '순찰차', 7_000_000_000, 60_000_000, 0.08, (l) => `도난 확률 -${pct(1 - Math.pow(0.92, l))}`, 1.2, 30),
      track('officers', '인원', 12_000_000_000, 100_000_000, 0.06, (l) => `손실액 -${pct(1 - Math.pow(0.94, l))}`, 1.2, 30),
      track('cctv', '관제 시스템', 20_000_000_000, 160_000_000, 0.07, (l) => `차단 확률 +${pct(Math.min(0.9, l * 0.07))}`, 1.22, 12),
    ],
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

/** 마일스톤 외형이 바뀌는 총 레벨 지점 */
export const TIER_THRESHOLDS = [0, 10, 25, 50, 100];

export function tierOf(totalLevel: number): number {
  let t = 0;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) if (totalLevel >= TIER_THRESHOLDS[i]) t = i;
  return t;
}

/** 사업 건물의 마일스톤 외형 단계 이름 */
export const BUSINESS_TIERS: Record<BusinessId, string[]> = {
  mine: ['빈 터', '갱도', '채굴장', '광산단지', '대형 광산도시'],
  factory: ['빈 터', '작업장', '소형 공장', '중형 공장', '스마트 팩토리'],
  fishery: ['빈 터', '나루터', '어항', '트롤 선단', '원양 기지'],
  park: ['빈 터', '간이 놀이터', '소형 유원지', '놀이공원', '테마파크'],
  corp: ['빈 터', '사무소', '사옥', '빌딩', '마천루'],
};

/** 도시 지도 위 배치. 세로 화면에 맞춘 3열 x 5행 격자 마을 */
export interface Lot {
  x: number;
  /** 행 인덱스 (WORLD.rows) */
  row: number;
  w: number;
}

export const WORLD = {
  w: 820,
  h: 1620,
  /** 각 행의 지면선 */
  rows: [285, 555, 825, 1095, 1375],
  /** 행 사이 도로의 y (지면선 + 이 값) */
  roadOffset: 62,
};

export const LOTS: Record<BuildingId, Lot> = {
  mine: { x: 145, row: 0, w: 215 },
  power: { x: 410, row: 0, w: 195 },
  factory: { x: 675, row: 0, w: 215 },

  school: { x: 145, row: 1, w: 205 },
  housing: { x: 410, row: 1, w: 205 },
  hospital: { x: 675, row: 1, w: 195 },

  shops: { x: 145, row: 2, w: 205 },
  road: { x: 410, row: 2, w: 175 },
  police: { x: 675, row: 2, w: 185 },

  fire: { x: 145, row: 3, w: 185 },
  green: { x: 410, row: 3, w: 205 },
  park: { x: 675, row: 3, w: 230 },

  corp: { x: 210, row: 4, w: 205 },
  fishery: { x: 600, row: 4, w: 245 },
};
