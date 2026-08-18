import { formatNumber } from '../core/num';
import type { BusinessId } from '../core/types';

export interface BlueprintUpgrade {
  id: string;
  name: string;
  desc: (level: number) => string;
  icon: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  /** 특정 사업 전용 강화면 지정 */
  business?: BusinessId;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const BLUEPRINT_UPGRADES: BlueprintUpgrade[] = [
  {
    id: 'allOutput',
    name: '도시 기간산업',
    icon: '🏗️',
    desc: (l) => `모든 사업 산출 +${pct(l * 0.25)}`,
    maxLevel: 50,
    baseCost: 2,
    costGrowth: 1.55,
  },
  {
    id: 'cycleSpeed',
    name: '물류 자동화',
    icon: '🚚',
    desc: (l) => `모든 사이클 시간 -${pct(1 - Math.pow(0.95, l))}`,
    maxLevel: 12,
    baseCost: 4,
    costGrowth: 1.9,
  },
  {
    id: 'startCash',
    name: '재개발 기금',
    icon: '🏦',
    desc: (l) => (l === 0 ? '재개발 후 시작 자금 없음' : `재개발 후 자금 ${formatNumber(1000 * Math.pow(9, l - 1))} 로 시작`),
    maxLevel: 12,
    baseCost: 3,
    costGrowth: 2.1,
  },
  {
    id: 'offlineCap',
    name: '창고 확장 설계',
    icon: '📦',
    desc: (l) => `오프라인 수익 상한 +${l * 2}시간`,
    maxLevel: 6,
    baseCost: 5,
    costGrowth: 2.4,
  },
  {
    id: 'offlineRate',
    name: '야간 교대제',
    icon: '🌙',
    desc: (l) => `오프라인 수익 효율 +${pct(l * 0.05)}`,
    maxLevel: 8,
    baseCost: 5,
    costGrowth: 2.2,
  },
  {
    id: 'chainFloor',
    name: '예비 자재 창고',
    icon: '🔗',
    desc: (l) => `자원 부족 시 최소 가동률 +${pct(l * 0.05)}`,
    maxLevel: 10,
    baseCost: 6,
    costGrowth: 2.0,
  },
  {
    id: 'keepManagers',
    name: '평생 고용 계약',
    icon: '🤝',
    desc: (l) => (l > 0 ? '재개발 후에도 매니저 유지' : '재개발 시 매니저가 해고됨'),
    maxLevel: 1,
    baseCost: 30,
    costGrowth: 1,
  },
  {
    id: 'startLevel',
    name: '도시 기본 설계',
    icon: '🗺️',
    desc: (l) => `재개발 후 모든 유닛 ${l}레벨에서 시작`,
    maxLevel: 25,
    baseCost: 4,
    costGrowth: 1.7,
  },
  {
    id: 'boostMine', name: '광업 특화', icon: '⛏️', business: 'mine',
    desc: (l) => `광산 산출 +${pct(l * 0.5)}`, maxLevel: 20, baseCost: 3, costGrowth: 1.6,
  },
  {
    id: 'boostFactory', name: '제조 특화', icon: '🏭', business: 'factory',
    desc: (l) => `공장 산출 +${pct(l * 0.5)}`, maxLevel: 20, baseCost: 3, costGrowth: 1.6,
  },
  {
    id: 'boostFishery', name: '수산 특화', icon: '🎣', business: 'fishery',
    desc: (l) => `어항 산출 +${pct(l * 0.5)}`, maxLevel: 20, baseCost: 3, costGrowth: 1.6,
  },
  {
    id: 'boostPark', name: '관광 특화', icon: '🎡', business: 'park',
    desc: (l) => `놀이공원 산출 +${pct(l * 0.5)}`, maxLevel: 20, baseCost: 3, costGrowth: 1.6,
  },
  {
    id: 'boostCorp', name: '금융 특화', icon: '🏢', business: 'corp',
    desc: (l) => `기업 산출 +${pct(l * 0.5)}`, maxLevel: 20, baseCost: 3, costGrowth: 1.6,
  },
];

export const BLUEPRINT_BY_ID = Object.fromEntries(
  BLUEPRINT_UPGRADES.map((u) => [u.id, u]),
) as Record<string, BlueprintUpgrade>;
