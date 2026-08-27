import type { BusinessId } from '../core/types';
import { PAL } from './palette';
import type { FacilityId } from './buildings';

/**
 * 문명 시대.
 * 석기시대에서 시작해, 목표 자금에 도달하면 도시를 전부 허물고 다음 문명으로 넘어간다.
 * (기획안의 '재개발'을 대체하는 장기 루프)
 */
export interface EraPalette {
  sky: string;
  skyTop: string;
  ground: string;
  road: string;
  water: string;
  wall: string;
  roof: string;
  accent: string;
}

export interface EraDef {
  id: string;
  name: string;
  short: string;
  /** 이 시대를 요약하는 한 줄 */
  tagline: string;
  /** 플레이어 호칭 */
  leader: string;
  /**
   * 이 시대를 졸업하는 데 필요한 도시 레벨.
   * 세수 절대값이 아니라 도시 레벨로 적는다 — 요구 세수는 레벨당 x78 이라
   * 시간 눈금으로 안정적이다.
   */
  advanceLevel: number;
  /**
   * 이 시대의 건설·업그레이드 비용 배율.
   * 문명 전환은 완전 초기화다 — 산출 보너스는 없다. 넘어갈수록 전부 비싸진다.
   */
  costMult: number;
  /** 이 시대의 사이클 시간 배율. 넘어갈수록 한 사이클이 느려진다 */
  cycleMult: number;
  palette: EraPalette;
  /** 사업 5종의 이 시대 이름 */
  business: Record<BusinessId, { name: string; icon: string; unitLabel: string }>;
  /** 사업별 공통 배율 장치(광산의 엘리베이터)의 이 시대 이름 */
  hoist: Record<BusinessId, string>;
  /** 사업이 뽑아내는 자원의 이 시대 이름 (ore/goods/food/pop 순) */
  resource: { ore: string; goods: string; food: string; pop: string };
  /** 시설 9종의 이 시대 이름 */
  facility: Record<FacilityId, { name: string; icon: string }>;
  /** 도시 규모 이름 (도시 레벨 5단계) */
  settlement: [string, string, string, string, string];
}

const P = (sky: string, skyTop: string, ground: string, road: string, water: string, wall: string, roof: string, accent: string): EraPalette => ({
  sky, skyTop, ground, road, water, wall, roof, accent,
});

export const ERAS: EraDef[] = [
  {
    id: 'stone',
    name: '석기 시대',
    short: '석기',
    tagline: '돌을 깨고 불을 피운다',
    leader: '족장',
    advanceLevel: 7,
    costMult: 1,
    cycleMult: 1.0,
    palette: P('#BFD9A8', '#DCEBC8', '#8FAE66', '#A08A63', '#7FC4D9', '#D8C9A3', '#8B6F47', '#FFC845'),
    business: {
      mine: { name: '돌 채취장', icon: '🪨', unitLabel: '채취터' },
      factory: { name: '석기 공방', icon: '🔨', unitLabel: '작업터' },
      fishery: { name: '물고기 잡이터', icon: '🐟', unitLabel: '잡이터' },
      park: { name: '모닥불 광장', icon: '🔥', unitLabel: '모닥불' },
      corp: { name: '부족 회의', icon: '🏕️', unitLabel: '회의' },
    },
    hoist: { mine: '지게길', factory: '돌 화덕', fishery: '통발', park: '장작더미', corp: '이야기꾼' },
    resource: { ore: '돌', goods: '석기', food: '물고기', pop: '무리' },
    facility: {
      housing: { name: '움집', icon: '🛖' },
      shops: { name: '물물교환터', icon: '🤝' },
      hospital: { name: '주술사 움막', icon: '🌿' },
      school: { name: '이야기터', icon: '📖' },
      fire: { name: '불 지킴이', icon: '🔥' },
      police: { name: '파수꾼', icon: '🗿' },
      green: { name: '신성한 숲', icon: '🌳' },
      power: { name: '큰 모닥불', icon: '🪵' },
      road: { name: '오솔길', icon: '🥾' },
    },
    settlement: ['빈 들판', '야영지', '무리', '부족', '큰 부족'],
  },
  {
    id: 'bronze',
    name: '청동기 시대',
    short: '청동',
    tagline: '구리를 녹여 도구를 만든다',
    leader: '군장',
    advanceLevel: 9,
    costMult: 3,
    cycleMult: 1.08,
    palette: P('#C9DCEB', '#E2EEF6', '#A8C97F', '#B39A6E', '#6FC3DF', '#E8DCC0', '#B5713F', '#FFC845'),
    business: {
      mine: { name: '구리 광맥', icon: '⛏️', unitLabel: '광맥' },
      factory: { name: '청동 공방', icon: '🏺', unitLabel: '공방' },
      fishery: { name: '통나무배 나루', icon: '🛶', unitLabel: '나루' },
      park: { name: '제례 광장', icon: '🗿', unitLabel: '제단' },
      corp: { name: '족장 회당', icon: '🏛️', unitLabel: '회당' },
    },
    hoist: { mine: '두레박', factory: '용광로', fishery: '나루 창고', park: '제단 계단', corp: '전령' },
    resource: { ore: '구리', goods: '청동기', food: '물고기', pop: '부족민' },
    facility: {
      housing: { name: '초가집', icon: '🏠' },
      shops: { name: '장터', icon: '🧺' },
      hospital: { name: '약초방', icon: '🌾' },
      school: { name: '서당', icon: '📜' },
      fire: { name: '물지게 조', icon: '🪣' },
      police: { name: '순찰대', icon: '🛡️' },
      green: { name: '제단 숲', icon: '🌲' },
      power: { name: '화덕', icon: '🔥' },
      road: { name: '흙길', icon: '🛤️' },
    },
    settlement: ['빈 들판', '작은 마을', '마을', '읍', '큰 읍'],
  },
  {
    id: 'iron',
    name: '철기 시대',
    short: '철기',
    tagline: '철을 두드려 나라를 세운다',
    leader: '성주',
    advanceLevel: 11,
    costMult: 9,
    cycleMult: 1.17,
    palette: P('#B8D0E0', '#D9E9F2', '#9FBE79', '#A89878', '#5FB8D4', '#DCD3BE', '#8C5A3C', '#FFC845'),
    business: {
      mine: { name: '철광산', icon: '⛏️', unitLabel: '갱' },
      factory: { name: '대장간', icon: '🔥', unitLabel: '화덕' },
      fishery: { name: '어항', icon: '🎣', unitLabel: '어선' },
      park: { name: '투기장', icon: '🏟️', unitLabel: '경기장' },
      corp: { name: '관청', icon: '🏯', unitLabel: '부서' },
    },
    hoist: { mine: '도르래', factory: '대장 화덕', fishery: '부두', park: '관중석', corp: '파발' },
    resource: { ore: '철광석', goods: '철기', food: '생선', pop: '군중' },
    facility: {
      housing: { name: '목조 가옥', icon: '🏘️' },
      shops: { name: '시장', icon: '🏪' },
      hospital: { name: '의원', icon: '💊' },
      school: { name: '향교', icon: '🏫' },
      fire: { name: '소화조', icon: '🚒' },
      police: { name: '포졸청', icon: '👮' },
      green: { name: '정원', icon: '🌳' },
      power: { name: '수차', icon: '💧' },
      road: { name: '자갈길', icon: '🛣️' },
    },
    settlement: ['빈 들판', '마을', '읍성', '성읍', '도성'],
  },
  {
    id: 'medieval',
    name: '중세',
    short: '중세',
    tagline: '성을 쌓고 길드를 연다',
    leader: '영주',
    advanceLevel: 13,
    costMult: 27,
    cycleMult: 1.26,
    palette: P('#AEC6D8', '#D2E4EF', '#93B473', '#9C9086', '#57AECC', '#E4DED0', '#7A4B39', '#FFC845'),
    business: {
      mine: { name: '갱도 광산', icon: '⛏️', unitLabel: '갱도' },
      factory: { name: '길드 공방', icon: '⚒️', unitLabel: '공방' },
      fishery: { name: '어선단', icon: '⛵', unitLabel: '어선' },
      park: { name: '축제 마당', icon: '🎪', unitLabel: '무대' },
      corp: { name: '상단 본부', icon: '🏛️', unitLabel: '상단' },
    },
    hoist: { mine: '권양기', factory: '공방장', fishery: '부두 크레인', park: '무대 장치', corp: '상단 장부' },
    resource: { ore: '광석', goods: '공산품', food: '생선', pop: '순례객' },
    facility: {
      housing: { name: '석조 주택', icon: '🏠' },
      shops: { name: '상가', icon: '🏪' },
      hospital: { name: '구빈원', icon: '🏥' },
      school: { name: '수도원 학교', icon: '⛪' },
      fire: { name: '소방대', icon: '🚒' },
      police: { name: '위병소', icon: '🛡️' },
      green: { name: '성곽 정원', icon: '🌷' },
      power: { name: '풍차', icon: '🌬️' },
      road: { name: '포석길', icon: '🧱' },
    },
    settlement: ['빈 들판', '촌락', '읍', '성곽 도시', '수도'],
  },
  {
    id: 'renaissance',
    name: '르네상스',
    short: '르네',
    tagline: '항해와 은행이 세상을 넓힌다',
    leader: '총독',
    advanceLevel: 15,
    costMult: 81,
    cycleMult: 1.36,
    palette: P('#B4D2E6', '#DCEDF7', '#9CC182', '#B0A894', '#63BEDC', '#F2EADA', '#B5563F', '#FFC845'),
    business: {
      mine: { name: '심층 광산', icon: '⛏️', unitLabel: '갱도' },
      factory: { name: '매뉴팩처', icon: '🏭', unitLabel: '작업장' },
      fishery: { name: '원양 선단', icon: '🚢', unitLabel: '선박' },
      park: { name: '극장 광장', icon: '🎭', unitLabel: '극장' },
      corp: { name: '은행 본점', icon: '🏦', unitLabel: '부서' },
    },
    hoist: { mine: '양수기', factory: '작업 배치도', fishery: '항해도', park: '무대 기계', corp: '복식부기' },
    resource: { ore: '광석', goods: '제품', food: '수산물', pop: '관람객' },
    facility: {
      housing: { name: '연립 주택', icon: '🏘️' },
      shops: { name: '상점가', icon: '🛍️' },
      hospital: { name: '병원', icon: '🏥' },
      school: { name: '아카데미', icon: '🎓' },
      fire: { name: '소방서', icon: '🚒' },
      police: { name: '치안청', icon: '👮' },
      green: { name: '정원 광장', icon: '⛲' },
      power: { name: '수력 방아', icon: '💧' },
      road: { name: '마차길', icon: '🛣️' },
    },
    settlement: ['빈 들판', '촌락', '읍', '도시', '항구 도시'],
  },
  {
    id: 'industrial',
    name: '산업혁명',
    short: '산업',
    tagline: '증기가 도시를 뒤덮는다',
    leader: '시장',
    advanceLevel: 17,
    costMult: 243,
    cycleMult: 1.47,
    palette: P('#AEB8C0', '#CFD8DE', '#8FA277', '#8E8B86', '#5A9FB8', '#D9D2C6', '#8A4B3A', '#FFC845'),
    business: {
      mine: { name: '탄광', icon: '⛏️', unitLabel: '갱' },
      factory: { name: '방직 공장', icon: '🏭', unitLabel: '라인' },
      fishery: { name: '증기 어선', icon: '🚢', unitLabel: '어선' },
      park: { name: '만국 박람회장', icon: '🎡', unitLabel: '전시관' },
      corp: { name: '주식회사', icon: '🏢', unitLabel: '부서' },
    },
    hoist: { mine: '증기 권양기', factory: '증기 기관', fishery: '증기 윈치', park: '관람차 축', corp: '전신망' },
    resource: { ore: '석탄', goods: '공산품', food: '수산물', pop: '관람객' },
    facility: {
      housing: { name: '연립 사택', icon: '🏘️' },
      shops: { name: '백화점', icon: '🏬' },
      hospital: { name: '종합병원', icon: '🏥' },
      school: { name: '공립학교', icon: '🏫' },
      fire: { name: '증기 소방대', icon: '🚒' },
      police: { name: '경찰서', icon: '👮' },
      green: { name: '시민 공원', icon: '🌳' },
      power: { name: '석탄 화력', icon: '🏭' },
      road: { name: '철도길', icon: '🚂' },
    },
    settlement: ['빈 들판', '공업 촌', '공업 읍', '공업 도시', '대공업 도시'],
  },
  {
    id: 'modern',
    name: '근대',
    short: '근대',
    tagline: '전기와 자동차의 시대',
    leader: '시장',
    advanceLevel: 19,
    costMult: 729,
    cycleMult: 1.59,
    // 아트 문서 3장이 지정한 팔레트 그대로. 다른 시대는 이걸 기준으로 틀었다
    palette: P(PAL.sky, PAL.skyTop, PAL.ground, PAL.road, PAL.water, PAL.wall, PAL.roof, PAL.accent),
    business: {
      mine: { name: '노천광', icon: '⛏️', unitLabel: '채굴장' },
      factory: { name: '자동화 공장', icon: '🏭', unitLabel: '라인' },
      fishery: { name: '트롤 선단', icon: '🎣', unitLabel: '어선' },
      park: { name: '놀이공원', icon: '🎡', unitLabel: '어트랙션' },
      corp: { name: '대기업 사옥', icon: '🏢', unitLabel: '부서' },
    },
    hoist: { mine: '엘리베이터', factory: '중앙 제어실', fishery: '부두 크레인', park: '정문 · 셔틀', corp: '본사 전산' },
    resource: { ore: '원석', goods: '제품', food: '식재료', pop: '관광객' },
    facility: {
      housing: { name: '아파트', icon: '🏢' },
      shops: { name: '쇼핑몰', icon: '🏬' },
      hospital: { name: '대학병원', icon: '🏥' },
      school: { name: '대학교', icon: '🎓' },
      fire: { name: '소방본부', icon: '🚒' },
      police: { name: '지방청', icon: '👮' },
      green: { name: '근린공원', icon: '🌳' },
      power: { name: '화력발전소', icon: '⚡' },
      road: { name: '4차선 도로', icon: '🛣️' },
    },
    settlement: ['빈 들판', '마을', '소도시', '도시', '대도시'],
  },
  {
    id: 'information',
    name: '정보화 시대',
    short: '정보',
    tagline: '데이터가 자원이 된다',
    leader: '광역시장',
    advanceLevel: 21,
    costMult: 2_187,
    cycleMult: 1.71,
    palette: P('#8FCCE4', '#B4E2F0', '#9FC48C', '#9FB0BC', '#57C0E0', '#EEF4F8', '#4A90D9', '#7EE0FF'),
    business: {
      mine: { name: '자동 채굴 플랜트', icon: '🤖', unitLabel: '플랜트' },
      factory: { name: '스마트 팩토리', icon: '🏭', unitLabel: '셀' },
      fishery: { name: '해양 목장', icon: '🐟', unitLabel: '구역' },
      park: { name: '테마파크', icon: '🎢', unitLabel: '어트랙션' },
      corp: { name: '글로벌 본사', icon: '🏙️', unitLabel: '본부' },
    },
    hoist: { mine: '자동 리프트', factory: '생산 관제 AI', fishery: '항만 자동화', park: '파크 관제실', corp: '데이터센터' },
    resource: { ore: '희토류', goods: '부품', food: '양식 수산물', pop: '방문객' },
    facility: {
      housing: { name: '고층 아파트', icon: '🏙️' },
      shops: { name: '복합몰', icon: '🏬' },
      hospital: { name: '의료 클러스터', icon: '🏥' },
      school: { name: '연구 대학', icon: '🔬' },
      fire: { name: '재난본부', icon: '🚨' },
      police: { name: '관제센터', icon: '📡' },
      green: { name: '생태공원', icon: '🌿' },
      power: { name: '원자력발전소', icon: '☢️' },
      road: { name: '고가도로', icon: '🛣️' },
    },
    settlement: ['빈 들판', '신도시', '광역시', '메가시티', '초거대도시'],
  },
  {
    id: 'space',
    name: '우주 시대',
    short: '우주',
    tagline: '도시가 궤도로 올라간다',
    leader: '사령관',
    advanceLevel: 23,
    costMult: 6_561,
    cycleMult: 1.85,
    palette: P('#2E4A72', '#4A6E9E', '#5E6E86', '#6E7A92', '#3FA8D8', '#DCE6F2', '#8B6DF0', '#7EE0FF'),
    business: {
      mine: { name: '소행성 채굴', icon: '☄️', unitLabel: '채굴선' },
      factory: { name: '궤도 조선소', icon: '🛰️', unitLabel: '도크' },
      fishery: { name: '양식 돔', icon: '🫧', unitLabel: '돔' },
      park: { name: '무중력 파크', icon: '🌌', unitLabel: '구역' },
      corp: { name: '성간 상사', icon: '🚀', unitLabel: '함대' },
    },
    hoist: { mine: '궤도 엘리베이터', factory: '도크 제어', fishery: '돔 순환계', park: '중력 제어', corp: '양자 통신망' },
    resource: { ore: '광물', goods: '모듈', food: '배양 단백질', pop: '이주민' },
    facility: {
      housing: { name: '거주 모듈', icon: '🛰️' },
      shops: { name: '상업 스테이션', icon: '🛒' },
      hospital: { name: '재생 의료동', icon: '🧬' },
      school: { name: 'AI 아카데미', icon: '🧠' },
      fire: { name: '방재 드론', icon: '🛸' },
      police: { name: '치안 AI', icon: '🤖' },
      green: { name: '바이오돔', icon: '🌱' },
      power: { name: '융합로', icon: '⚛️' },
      road: { name: '자기부상 궤도', icon: '🚄' },
    },
    settlement: ['빈 궤도', '전초 기지', '거주구', '궤도 도시', '성간 도시'],
  },
];

export const MAX_ERA = ERAS.length - 1;

export function eraDef(index: number): EraDef {
  return ERAS[Math.max(0, Math.min(MAX_ERA, index))];
}

/** 시대 전환으로 얻는 영구 재화. 내부 id 는 blueprint 를 그대로 쓴다. */
export const LEGACY = { name: '유산', icon: '🏺' } as const;

/** 도시 발전 단계(0~4) 이름 — 시대마다 다르다 */
export function settlementNameOf(era: number, stage: number): string {
  const list = eraDef(era).settlement;
  return list[Math.max(0, Math.min(list.length - 1, stage))];
}
