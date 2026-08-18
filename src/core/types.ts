export type ResourceId = 'cash' | 'ore' | 'goods' | 'food' | 'pop' | 'blueprint';
export type BusinessId = 'mine' | 'factory' | 'fishery' | 'park' | 'corp';

export interface UnitDef {
  id: string;
  name: string;
  /** 1레벨 구매가 (사업 costScale 적용 전) */
  baseCost: number;
  /** 레벨당 가격 상승률 */
  costGrowth: number;
  /** 1레벨 기준 1사이클 산출 (사업 outScale 적용 전) */
  baseOutput: number;
  /** 1사이클 소요 초 */
  cycleTime: number;
  /** 매니저 고용가 (costScale 적용 전) */
  managerCost: number;
  managerName: string;
}

export interface ChainInput {
  resource: ResourceId;
  /** 자기 생산 1포인트당 필요한 상위 자원 포인트 (스케일 정규화 후 비교) */
  ratio: number;
}

export interface BusinessDef {
  id: BusinessId;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  unlockCityLevel: number;
  unitLabel: string;
  output: ResourceId;
  /** 산출 1단위당 현금 */
  price: number;
  costScale: number;
  outScale: number;
  input?: ChainInput;
  units: UnitDef[];
}

export interface UnitState {
  level: number;
  /** 진행 중인 사이클의 경과 초 */
  progress: number;
  running: boolean;
  manager: boolean;
}

export interface BusinessState {
  units: UnitState[];
  /** 광고 부스터 만료 시각(ms epoch) */
  boostUntil: number;
  /** 매니저 체험(광고) 만료 시각(ms epoch) */
  trialUntil: number;
  totalProduced: number;
}

export interface CityState {
  level: number;
  /** 이번 회차 누적 세수 (도시 레벨 경험치) */
  taxRun: number;
  /** 전체 누적 세수 */
  taxTotal: number;
  storageLevel: number;   // 오프라인 상한 업그레이드
  logisticsLevel: number; // 오프라인 효율 업그레이드
}

export interface PrestigeState {
  blueprints: number;
  /** 설계도 업그레이드 id -> 레벨 */
  upgrades: Record<string, number>;
  count: number;
  lastAt: number;
}

export interface MissionState {
  day: string;              // YYYY-MM-DD (로컬)
  ids: string[];
  targets: number[];
  progress: number[];
  claimed: boolean[];
}

export interface AttendanceState {
  day: string;
  streak: number;      // 0..6 => 다음 수령 인덱스
  claimedToday: boolean;
}

export interface SettingsState {
  notation: 'short' | 'scientific';
  textScale: 1 | 1.15 | 1.3;
  reducedMotion: boolean;
  haptics: boolean;
  sound: boolean;
}

export interface ShopState {
  adFree: boolean;
  piggyValue: number;    // 저금통 포인트
  piggyBought: number;
  purchases: string[];
  firstPurchaseDone: boolean;
}

export interface StatsState {
  cashEarnedRun: number;
  cashEarnedTotal: number;
  playSeconds: number;
  adsWatched: number;
  taps: number;
  startedAt: number;
}

export interface GameState {
  version: number;
  lastSeen: number;
  /** 기기 시간 조작 감지 누적 보정치(초) */
  timeSkew: number;
  resources: Record<ResourceId, number>;
  businesses: Record<BusinessId, BusinessState>;
  city: CityState;
  prestige: PrestigeState;
  missions: MissionState;
  attendance: AttendanceState;
  settings: SettingsState;
  shop: ShopState;
  stats: StatsState;
  flags: Record<string, boolean>;
  /** 광고 배치별 마지막 시청 시각 */
  adCooldowns: Record<string, number>;
}

export interface OfflineReport {
  seconds: number;
  cappedSeconds: number;
  cash: number;
  perBusiness: { id: BusinessId; cash: number }[];
}
