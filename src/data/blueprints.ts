/**
 * 재개발(프레스티지) 설계도 사용처 (기획서 수치표 8장).
 * 비용은 구매할 때마다 x1.5.
 */
export interface BlueprintUpgrade {
  id: string;
  name: string;
  icon: string;
  baseCost: number;
  maxLevel: number;
  desc: (level: number) => string;
}

export const BLUEPRINT_UPGRADES: BlueprintUpgrade[] = [
  {
    id: 'output_bonus',
    name: '전 사업 산출',
    icon: '📈',
    baseCost: 5,
    maxLevel: 100,
    desc: (l) => `모든 사업 산출 +${l * 10}%`,
  },
  {
    id: 'start_fund',
    name: '시작 자금',
    icon: '🏦',
    baseCost: 3,
    maxLevel: 12,
    desc: (l) => (l === 0 ? '재개발 후 기본 자금' : `재개발 후 시작 자금 x${Math.pow(10, l)}`),
  },
  {
    id: 'keep_manager',
    name: '자동화 유지',
    icon: '🤝',
    baseCost: 20,
    maxLevel: 60,
    desc: (l) => `재개발 후 매니저 ${l}명 유지`,
  },
  {
    id: 'minigame_bonus',
    name: '미니게임 배율',
    icon: '🎮',
    baseCost: 8,
    maxLevel: 20,
    desc: (l) => `미니게임 보상 +${l * 25}%`,
  },
  {
    id: 'offline_cap',
    name: '오프라인 상한',
    icon: '🌙',
    baseCost: 15,
    maxLevel: 12,
    desc: (l) => `오프라인 상한 +${l * 2}시간`,
  },
  {
    id: 'facility_bonus',
    name: '시설 배율',
    icon: '🏙️',
    baseCost: 10,
    maxLevel: 20,
    desc: (l) => `전 시설 효과 +${l * 15}%`,
  },
  {
    id: 'overclock',
    name: '초과 가동',
    icon: '⏫',
    baseCost: 12,
    maxLevel: 20,
    desc: (l) => (l === 0 ? '자동화 효율 100%' : `자동화 효율 ${100 + l * 5}%`),
  },
];

export const BLUEPRINT_BY_ID = Object.fromEntries(
  BLUEPRINT_UPGRADES.map((u) => [u.id, u]),
) as Record<string, BlueprintUpgrade>;
