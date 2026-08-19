import { BIZ_COLOR } from './palette';
import { MINE_LADDER, managerCostOf, type LadderRow } from './units';
import type { BusinessDef, BusinessId, UnitDef } from '../core/types';

/**
 * 사업 5종. 각 사업은 유닛 12개 (광산과 동일 구조).
 * 수치는 광산 사다리 x 사업별 스케일 (기획서 수치표 3장).
 */
interface Scale {
  /** 1번 유닛 base_cost / 4 */
  costK: number;
  /** 1번 유닛 base_out / 1 */
  outK: number;
  /** 1번 유닛 사이클 / 0.6 */
  cycleK: number;
}

function units(names: [string, string][], scale: Scale): UnitDef[] {
  return MINE_LADDER.map((row: LadderRow, i) => ({
    id: `u${i}`,
    name: names[i][0],
    managerName: names[i][1],
    unlockCost: row.unlock * scale.costK,
    baseCost: row.base * scale.costK,
    costGrowth: row.rate,
    baseOutput: row.baseOut * scale.outK,
    cycleTime: row.cycle * scale.cycleK,
    managerCost: managerCostOf(row) * scale.costK,
  }));
}

const MINE: Scale = { costK: 1, outK: 1, cycleK: 1 };
const FACTORY: Scale = { costK: 1_250, outK: 800, cycleK: 2 / 0.6 };
const FISHERY: Scale = { costK: 600_000, outK: 350_000, cycleK: 4 / 0.6 };
const PARK: Scale = { costK: 300_000_000, outK: 160_000_000, cycleK: 8 / 0.6 };
const CORP: Scale = { costK: 1.5e14, outK: 8e13, cycleK: 16 / 0.6 };

export const BUSINESSES: BusinessDef[] = [
  {
    id: 'mine',
    name: '광산',
    subtitle: '원석을 캔다',
    icon: '⛏️',
    color: BIZ_COLOR.mine,
    unlockCityLevel: 1,
    unitLabel: '층',
    hoistName: '엘리베이터',
    hoistIcon: '🛗',
    output: 'ore',
    price: 1,
    costScale: MINE.costK,
    outScale: MINE.outK,
    units: units(
      [
        ['1층 지표 갱도', '반장 김철수'],
        ['2층 석탄 갱도', '갱도장 박영희'],
        ['3층 철광 갱도', '발파 기사 이만수'],
        ['4층 심층 철광', '측량사 정다혜'],
        ['5층 구리 갱도', '드릴 정비사 최강훈'],
        ['6층 심층 구리', '플랜트 소장 한지우'],
        ['7층 은맥 갱도', '지질 기사 오세라'],
        ['8층 심층 은맥', '안전 관리자 배도윤'],
        ['9층 금맥 갱도', '수직갱 감독 류하경'],
        ['10층 심층 금맥', '설비 팀장 남기훈'],
        ['11층 결정층', '결정 분석관 서윤后'.replace('后', '아')],
        ['12층 심층 결정', '광산 총괄 임세영'],
      ],
      MINE,
    ),
  },
  {
    id: 'factory',
    name: '공장',
    subtitle: '원석을 제품으로',
    icon: '🏭',
    color: BIZ_COLOR.factory,
    unlockCityLevel: 3,
    unitLabel: '라인',
    hoistName: '중앙 제어실',
    hoistIcon: '🎛️',
    output: 'goods',
    price: 1,
    costScale: FACTORY.costK,
    outScale: FACTORY.outK,
    input: { resource: 'ore', ratio: 1.1 },
    units: units(
      [
        ['수동 조립대', '조장 윤성호'],
        ['성형 라인', '라인장 배수진'],
        ['도장 라인', '품질관리 노유진'],
        ['정밀 가공 라인', '공정기사 서동민'],
        ['자동화 셀', '로봇 담당 오하늘'],
        ['로봇 용접 셀', '용접 기사 진태우'],
        ['클린룸 공정', '클린룸 관리 하예린'],
        ['정밀 검사동', '검사 총괄 문시현'],
        ['대형 프레스', '프레스 반장 곽성재'],
        ['복합 소재동', '소재 연구원 신아름'],
        ['무인 공정동', '무인화 담당 천유빈'],
        ['스마트 팩토리', '공장장 임세영'],
      ],
      FACTORY,
    ),
  },
  {
    id: 'fishery',
    name: '어항',
    subtitle: '식재료를 잡는다',
    icon: '🎣',
    color: BIZ_COLOR.fishery,
    unlockCityLevel: 6,
    unitLabel: '어선',
    hoistName: '부두 크레인',
    hoistIcon: '🏗️',
    output: 'food',
    price: 1,
    costScale: FISHERY.costK,
    outScale: FISHERY.outK,
    units: units(
      [
        ['낚싯배', '선장 강두식'],
        ['연안 그물배', '항해사 문가영'],
        ['트롤 어선', '기관장 신태호'],
        ['원양 어선', '어로장 유미래'],
        ['해상 양식장', '양식 기사 조한별'],
        ['심해 선단', '선단주 백재훈'],
        ['냉동 운반선', '냉동 관리 남주희'],
        ['참치 선단', '참치 선장 고동해'],
        ['해저 채취선', '잠수 반장 여진솔'],
        ['심해 플랜트', '플랜트장 표승우'],
        ['인공 어초 단지', '해양학자 하늘빛'],
        ['해양 목장', '목장 총괄 진서우'],
      ],
      FISHERY,
    ),
  },
  {
    id: 'park',
    name: '놀이공원',
    subtitle: '관광객을 인구로',
    icon: '🎡',
    color: BIZ_COLOR.park,
    unlockCityLevel: 10,
    unitLabel: '어트랙션',
    hoistName: '정문 · 셔틀',
    hoistIcon: '🚌',
    output: 'pop',
    price: 1,
    costScale: PARK.costK,
    outScale: PARK.outK,
    input: { resource: 'food', ratio: 1.8 },
    units: units(
      [
        ['회전목마', '운영원 남지호'],
        ['범퍼카', '안전요원 구예린'],
        ['대관람차', '정비반장 표민석'],
        ['유령의 집', '연출감독 여름'],
        ['롤러코스터', '수석 정비사 하람'],
        ['워터파크', '파크 총괄 도경수'],
        ['자이로드롭', '고소 정비 김하늘'],
        ['바이킹', '기계 담당 송우진'],
        ['4D 시어터', '영상감독 채린'],
        ['사파리 존', '사육사 안도현'],
        ['아이스링크', '빙질 관리 유설'],
        ['테마 성', '파크 대표 이든'],
      ],
      PARK,
    ),
  },
  {
    id: 'corp',
    name: '기업',
    subtitle: '제품을 매출로',
    icon: '🏢',
    color: BIZ_COLOR.corp,
    unlockCityLevel: 15,
    unitLabel: '부서',
    hoistName: '본사 전산',
    hoistIcon: '🖥️',
    output: 'cash',
    price: 1,
    costScale: CORP.costK,
    outScale: CORP.outK,
    input: { resource: 'goods', ratio: 40 },
    units: units(
      [
        ['영업팀', '팀장 진서우'],
        ['마케팅팀', '실장 마윤아'],
        ['연구소', '소장 권도현'],
        ['해외사업부', '본부장 셀린'],
        ['금융부문', '부문장 남궁혁'],
        ['지주회사', 'CEO 대행 이든'],
        ['데이터센터', 'CTO 백서진'],
        ['법무본부', '법무이사 정한결'],
        ['M&A 본부', '전략이사 유하진'],
        ['벤처투자', '투자심사역 오재이'],
        ['우주사업부', '우주본부장 강태양'],
        ['글로벌 본사', '회장 임세영'],
      ],
      CORP,
    ),
  },
];

export const BUSINESS_BY_ID = Object.fromEntries(BUSINESSES.map((b) => [b.id, b])) as Record<
  BusinessId,
  BusinessDef
>;

export const RESOURCE_META: Record<string, { name: string; icon: string }> = {
  cash: { name: '자금', icon: '💰' },
  material: { name: '물자', icon: '📦' },
  ore: { name: '원석', icon: '🪨' },
  goods: { name: '제품', icon: '📦' },
  food: { name: '식재료', icon: '🐟' },
  pop: { name: '관광객', icon: '🧳' },
  gem: { name: '보석', icon: '💎' },
  blueprint: { name: '설계도', icon: '📐' },
};
