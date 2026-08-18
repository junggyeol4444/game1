// 밸런스 상수 전부 여기. 엔진(Unity 등)으로 이식할 때 이 파일 + businesses.ts 만 옮기면 된다.

export const CONFIG = {
  saveKey: 'city-idle-save-v1',
  saveVersion: 1,
  /** 저장 주기(초) */
  autosaveInterval: 10,
  /** 시뮬레이션 최대 프레임 간격(초). 탭 백그라운드 복귀 시 폭주 방지 */
  maxFrameDelta: 0.25,
  /** 이 시간 이상 프레임이 끊기면 오프라인 수익 계산으로 넘긴다(초) */
  backgroundThreshold: 8,

  startCash: 20,

  /** 현금 획득액 중 도시 세수로 잡히는 비율(= 도시 레벨 경험치) */
  taxRate: 0.1,

  /** 도시 레벨업에 필요한 누적 세수: base * growth^(L-1) */
  cityLevel: { base: 60, growth: 4.2, max: 50 },

  /** 자원 사슬은 이 도시 레벨부터 작동 (초반 3탭은 독립) */
  chainStartLevel: 12,
  /** 상위 자원이 모자라도 최소 이만큼은 생산 (스트레스 완화) */
  chainIdleFloor: 0.25,

  /** 인구 노동력 배율: 1 + coef * log10(1+pop) */
  laborCoef: 0.1,

  offline: {
    baseCapHours: 2,
    /** 창고 레벨당 +1시간 */
    capPerStorage: 1,
    maxStorageLevel: 10,
    storageBaseCost: 5_000,
    storageCostGrowth: 6.5,
    /** 오프라인 수익 효율 (자동화된 유닛만 계산) */
    baseRate: 0.5,
    ratePerLogistics: 0.05,
    maxLogisticsLevel: 10,
    logisticsBaseCost: 20_000,
    logisticsCostGrowth: 7,
    /** 이 시간 미만이면 복귀 팝업 생략 */
    minReportSeconds: 60,
  },

  /** 유닛 레벨 마일스톤: 도달 시 영구 보너스 */
  milestones: [
    { level: 10, type: 'output', factor: 2 },
    { level: 25, type: 'speed', factor: 2 },
    { level: 50, type: 'output', factor: 2 },
    { level: 100, type: 'speed', factor: 2 },
    { level: 200, type: 'output', factor: 3 },
    { level: 300, type: 'output', factor: 3 },
    { level: 400, type: 'output', factor: 4 },
  ] as const,

  /** 사이클 시간 하한(초). 너무 짧으면 렌더/체감이 무너짐 */
  minCycleTime: 0.05,

  prestige: {
    /** 재개발 해금 도시 레벨 */
    unlockCityLevel: 20,
    /** 설계도 = coef * (누적세수 / divisor)^exponent */
    coef: 80,
    divisor: 1e14,
    exponent: 0.5,
    /** 광고 시청 시 설계도 보너스 */
    adBonus: 0.5,
  },

  ads: {
    /** 광고 부스터 지속 시간(초) */
    boostSeconds: 120,
    boostFactor: 2,
    /** 배치별 쿨다운(초) */
    cooldowns: {
      dailyDouble: 0,
      tabBoost: 60,
      trialManager: 180,
      cashDrop: 300,
      prestigeBonus: 0,
      missionReroll: 600,
    } as Record<string, number>,
    /** 재화 부족 시 광고 지급량: 현재 초당 수입 * 이 초 */
    cashDropSeconds: 900,
    /** 매니저 체험 고용 지속 시간(초) */
    trialManagerSeconds: 600,
    /** 웹 스텁 광고 길이(초) */
    stubSeconds: 3,
  },

  missions: {
    count: 3,
    // 기기 로컬 자정 기준으로 초기화된다 (state.ts todayKey)
  },

  attendance: {
    /** 7일 캘린더. amount 는 "현재 초당 수입 x 초" 로 환산 */
    rewards: [
      { type: 'cashSeconds', amount: 600 },
      { type: 'boost', amount: 300 },
      { type: 'cashSeconds', amount: 1800 },
      { type: 'blueprint', amount: 1 },
      { type: 'cashSeconds', amount: 3600 },
      { type: 'boost', amount: 900 },
      { type: 'cashSeconds', amount: 10800 },
    ] as const,
  },
} as const;

export type MilestoneDef = (typeof CONFIG.milestones)[number];
