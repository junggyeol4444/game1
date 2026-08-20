export type ResourceId = 'cash' | 'material' | 'ore' | 'goods' | 'food' | 'pop' | 'gem' | 'blueprint';
export type BusinessId = 'mine' | 'factory' | 'fishery' | 'park' | 'corp';

export interface UnitDef {
  id: string;
  name: string;
  /** 이 유닛을 여는 비용 (1번 유닛은 0) */
  unlockCost: number;
  /** 레벨업 base_cost */
  baseCost: number;
  /** 레벨당 가격 상승률 */
  costGrowth: number;
  /** 1레벨 기준 1사이클 산출 */
  baseOutput: number;
  /** 1사이클 소요 초 */
  cycleTime: number;
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
  /** 전 유닛 공통 배율 장치 (광산의 엘리베이터) */
  hoistName: string;
  hoistIcon: string;
  output: ResourceId;
  /** 산출 1단위당 현금 */
  price: number;
  costScale: number;
  outScale: number;
  input?: ChainInput;
  units: UnitDef[];
}

export interface UnitState {
  /** 유닛이 열렸는가 */
  unlocked: boolean;
  level: number;
  /** 진행 중인 사이클의 경과 초 */
  progress: number;
  running: boolean;
  /** 2단계: 설비 배치 (효율 50%) */
  equip: boolean;
  /** 3단계: 매니저 배치 (효율 100%) */
  manager: boolean;
}

export interface BusinessState {
  units: UnitState[];
  /** 광고 부스터 만료 시각(ms epoch) */
  boostUntil: number;
  /** 매니저 체험(광고) 만료 시각(ms epoch) */
  trialUntil: number;
  /** 공통 배율 장치 레벨 (1부터) */
  hoistLevel: number;
  totalProduced: number;
}

export interface FacilityState {
  unlocked: boolean;
  level: number;
}

export interface MinigameState {
  /** 무료 횟수가 리셋된 날짜 (매일 04:00 기준) */
  day: string;
  plays: number;
  adPlays: number;
  /** 최고 성공률 0~1 */
  bestRate: number;
  /** 미니게임 성적 배율 만료 시각 */
  boostUntil: number;
  boostMult: number;
}

export type CityEventKind = 'fire' | 'theft';

export interface CityEvent {
  id: string;
  kind: CityEventKind;
  /** 대상 건물 */
  target: string;
  until: number;
  /** 화재: 산출 감소율 */
  severity: number;
}

export interface CollectionState {
  /** 미니게임 특산물 */
  specs: number;
  satisfaction: number;
  funds: number;
  fish: string[];
  /** 건물 id -> 지금까지 본 최고 외형 단계 */
  seenTiers: Record<string, number>;
}

export interface CityState {
  level: number;
  /** 이번 회차 누적 세수 (도시 레벨 경험치) */
  taxRun: number;
  /** 전체 누적 세수 */
  taxTotal: number;
  /** 오프라인 상한 업그레이드 0~5 */
  capLevel: number;
  /** 오프라인 효율 업그레이드 0~5 */
  effLevel: number;
  /** 현재 인구 (주거지 상한까지 서서히 유입) */
  pop: number;
}

export interface PrestigeState {
  blueprints: number;
  /** 유산 강화 id -> 레벨 */
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
  /** 현재 문명 시대 (0 = 석기 시대) */
  era: number;
  /** 기기 시간 조작 감지 누적 보정치(초) */
  timeSkew: number;
  resources: Record<ResourceId, number>;
  businesses: Record<BusinessId, BusinessState>;
  facilities: Record<string, FacilityState>;
  minigames: Record<string, MinigameState>;
  events: CityEvent[];
  nextEventAt: number;
  collection: CollectionState;
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
