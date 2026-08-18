import type { BusinessDef, UnitDef } from '../core/types';

/**
 * 모든 사업이 공유하는 유닛 사다리(상대값).
 * 검증된 방치형 곡선(초기 저가/고회전 -> 후반 고가/저회전)을 그대로 쓰고,
 * 사업별로 costScale / outScale 만 곱해 난이도 계단을 만든다.
 */
interface LadderRow {
  baseCost: number;
  costGrowth: number;
  baseOutput: number;
  cycleTime: number;
  managerCost: number;
}

const LADDER: LadderRow[] = [
  { baseCost: 4,         costGrowth: 1.07, baseOutput: 1,       cycleTime: 0.8, managerCost: 1_000 },
  { baseCost: 60,        costGrowth: 1.15, baseOutput: 60,      cycleTime: 3,   managerCost: 15_000 },
  { baseCost: 720,       costGrowth: 1.14, baseOutput: 540,     cycleTime: 6,   managerCost: 100_000 },
  { baseCost: 8_640,     costGrowth: 1.13, baseOutput: 4_320,   cycleTime: 12,  managerCost: 500_000 },
  { baseCost: 103_680,   costGrowth: 1.12, baseOutput: 51_840,  cycleTime: 24,  managerCost: 1_200_000 },
  { baseCost: 1_244_160, costGrowth: 1.11, baseOutput: 622_080, cycleTime: 96,  managerCost: 10_000_000 },
];

function units(names: [string, string][]): UnitDef[] {
  return LADDER.map((row, i) => ({
    id: `u${i}`,
    name: names[i][0],
    managerName: names[i][1],
    ...row,
  }));
}

export const BUSINESSES: BusinessDef[] = [
  {
    id: 'mine',
    name: '광산',
    subtitle: '원석을 캔다',
    icon: '⛏️',
    color: '#c98a3c',
    unlockCityLevel: 1,
    unitLabel: '갱도',
    output: 'ore',
    price: 1,
    costScale: 1,
    outScale: 1,
    units: units([
      ['지표 채굴장', '반장 김철수'],
      ['제1 갱도', '갱도장 박영희'],
      ['제2 갱도', '발파 기사 이만수'],
      ['심층 갱도', '측량사 정다혜'],
      ['자동 채굴 드릴', '드릴 정비사 최강훈'],
      ['지열 채굴 플랜트', '플랜트 소장 한지우'],
    ]),
  },
  {
    id: 'factory',
    name: '공장',
    subtitle: '원석을 제품으로',
    icon: '🏭',
    color: '#5b8def',
    unlockCityLevel: 3,
    unitLabel: '라인',
    output: 'goods',
    price: 1,
    costScale: 50,
    outScale: 8.33,
    input: { resource: 'ore', ratio: 1.2 },
    units: units([
      ['수동 조립대', '조장 윤성호'],
      ['성형 라인', '라인장 배수진'],
      ['도장 라인', '품질관리 노유진'],
      ['정밀 가공 라인', '공정기사 서동민'],
      ['자동화 셀', '로봇 담당 오하늘'],
      ['스마트 팩토리', '공장장 임세영'],
    ]),
  },
  {
    id: 'fishery',
    name: '어항',
    subtitle: '식재료를 잡는다',
    icon: '🎣',
    color: '#22a2a2',
    unlockCityLevel: 7,
    unitLabel: '어선',
    output: 'food',
    price: 1,
    costScale: 15000,
    outScale: 416,
    units: units([
      ['낚싯배', '선장 강두식'],
      ['연안 그물배', '항해사 문가영'],
      ['트롤 어선', '기관장 신태호'],
      ['원양 어선', '어로장 유미래'],
      ['해상 양식장', '양식 기사 조한별'],
      ['심해 선단', '선단주 백재훈'],
    ]),
  },
  {
    id: 'park',
    name: '놀이공원',
    subtitle: '관광객을 인구로',
    icon: '🎡',
    color: '#e0629b',
    unlockCityLevel: 12,
    unitLabel: '어트랙션',
    output: 'pop',
    price: 1,
    costScale: 22000000,
    outScale: 101852,
    input: { resource: 'food', ratio: 2.0 },
    units: units([
      ['회전목마', '운영원 남지호'],
      ['범퍼카', '안전요원 구예린'],
      ['대관람차', '정비반장 표민석'],
      ['유령의 집', '연출감독 여름'],
      ['롤러코스터', '수석 정비사 하람'],
      ['워터파크', '파크 총괄 도경수'],
    ]),
  },
  {
    id: 'corp',
    name: '기업',
    subtitle: '제품을 매출로',
    icon: '🏢',
    color: '#8b6df0',
    unlockCityLevel: 17,
    unitLabel: '부서',
    output: 'cash',
    price: 1,
    costScale: 22500000000,
    outScale: 17300000,
    input: { resource: 'goods', ratio: 55 },
    units: units([
      ['영업팀', '팀장 진서우'],
      ['마케팅팀', '실장 마윤아'],
      ['연구소', '소장 권도현'],
      ['해외사업부', '본부장 셀린'],
      ['금융부문', '부문장 남궁혁'],
      ['지주회사', 'CEO 대행 이든'],
    ]),
  },
];

export const BUSINESS_BY_ID = Object.fromEntries(BUSINESSES.map((b) => [b.id, b])) as Record<
  string,
  BusinessDef
>;

export const RESOURCE_META: Record<string, { name: string; icon: string }> = {
  cash: { name: '자금', icon: '💰' },
  ore: { name: '원석', icon: '🪨' },
  goods: { name: '제품', icon: '📦' },
  food: { name: '식재료', icon: '🐟' },
  pop: { name: '인구', icon: '🧑' },
  blueprint: { name: '설계도', icon: '📐' },
};
