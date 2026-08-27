/**
 * 유산 사용처 — 문명 전환으로 넘어온 영구 강화 (기획서 수치표 8장의 설계도 강화를 대체).
 * 도시를 허물어도 남는다. 비용은 구매할 때마다 x1.5.
 */
export interface LegacyUpgrade {
  id: string;
  name: string;
  icon: string;
  baseCost: number;
  maxLevel: number;
  desc: (level: number) => string;
}

export const LEGACY_UPGRADES: LegacyUpgrade[] = [
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
    desc: (l) => (l === 0 ? '새 문명 시작 자금 기본' : `새 문명 시작 자금 x${Math.pow(10, l)}`),
  },
  {
    id: 'keep_manager',
    name: '자동화 유지',
    icon: '🤝',
    baseCost: 20,
    maxLevel: 60,
    desc: (l) => `문명 전환 후 매니저 ${l}명 유지`,
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

export const LEGACY_BY_ID = Object.fromEntries(
  LEGACY_UPGRADES.map((u) => [u.id, u]),
) as Record<string, LegacyUpgrade>;
