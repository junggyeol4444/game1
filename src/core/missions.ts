import { BUSINESSES } from '../data/businesses';
import { CONFIG } from '../data/config';
import { formatNumber } from './num';
import { bizName } from './era';
import { totalCashPerSecond } from './economy';
import { todayKey } from './state';
import type { BusinessId, GameState } from './types';

export type MissionEvent =
  | 'cashEarned'
  | 'levelBought'
  | 'manualCycle'
  | 'adWatched'
  | 'minigamePlayed'
  | `produced:${BusinessId}`;

export interface MissionReward {
  kind: 'cash' | 'boost' | 'blueprint';
  amount: number;
  business?: BusinessId;
}

export interface MissionDef {
  id: string;
  event: MissionEvent;
  icon: string;
  /** 목표치 (플레이어 진행도에 비례) */
  target: (state: GameState) => number;
  label: (target: number, state: GameState) => string;
  reward: (state: GameState) => MissionReward;
  /** 해당 사업이 해금돼야 등장 */
  requires?: BusinessId;
}

const cashPerSec = (s: GameState) => Math.max(1, totalCashPerSecond(s));

export const MISSION_DEFS: MissionDef[] = [
  {
    id: 'earn10m',
    event: 'cashEarned',
    icon: '💰',
    target: (s) => cashPerSec(s) * 600,
    label: (t) => `자금 ${formatNumber(t)} 벌기`,
    reward: (s) => ({ kind: 'cash', amount: cashPerSec(s) * 900 }),
  },
  {
    id: 'buy20',
    event: 'levelBought',
    icon: '⬆️',
    target: () => 20,
    label: (t) => `업그레이드 ${t}회 구매`,
    reward: (s) => ({ kind: 'cash', amount: cashPerSec(s) * 1200 }),
  },
  {
    id: 'tap30',
    event: 'manualCycle',
    icon: '👆',
    target: () => 30,
    label: (t) => `직접 ${t}회 가동시키기`,
    reward: (s) => ({ kind: 'cash', amount: cashPerSec(s) * 900 }),
  },
  {
    id: 'ad3',
    event: 'adWatched',
    icon: '🎬',
    target: () => 3,
    label: (t) => `부스터 ${t}회 사용`,
    reward: (s) => ({ kind: 'cash', amount: cashPerSec(s) * 1800 }),
  },
  {
    id: 'minigame2',
    event: 'minigamePlayed',
    icon: '🎮',
    target: () => 2,
    label: (t) => `미니게임 ${t}판 하기`,
    reward: (s) => ({ kind: 'cash', amount: cashPerSec(s) * 2400 }),
  },
  ...BUSINESSES.map<MissionDef>((def) => ({
    id: `produce_${def.id}`,
    event: `produced:${def.id}` as MissionEvent,
    icon: def.icon,
    requires: def.id,
    target: (s) => {
      const rate = totalCashPerSecond(s) || 1;
      return Math.max(10, rate * 300);
    },
    label: (t, s) => `${bizName(s, def.id)}에서 ${formatNumber(t)} 생산`,
    reward: () => ({ kind: 'boost', amount: 300, business: def.id }),
  })),
];

const MISSION_BY_ID = Object.fromEntries(MISSION_DEFS.map((m) => [m.id, m]));

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 날짜가 바뀌었으면 미션 3개를 새로 뽑는다 */
export function refreshMissions(state: GameState, nowMs = Date.now()): boolean {
  const day = todayKey(nowMs);
  if (state.missions.day === day && state.missions.ids.length > 0) return false;

  const pool = MISSION_DEFS.filter((m) => {
    if (!m.requires) return true;
    const def = BUSINESSES.find((b) => b.id === m.requires)!;
    return state.city.level >= def.unlockCityLevel;
  });
  let seed = hash(day + state.stats.startedAt);
  const picked: string[] = [];
  const bag = [...pool];
  while (picked.length < CONFIG.missions.count && bag.length > 0) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const i = seed % bag.length;
    picked.push(bag[i].id);
    bag.splice(i, 1);
  }
  state.missions = {
    day,
    ids: picked,
    targets: picked.map((id) => Math.max(1, Math.floor(MISSION_BY_ID[id].target(state)))),
    progress: picked.map(() => 0),
    claimed: picked.map(() => false),
  };
  return true;
}

/** 목표치는 미션이 뽑힌 시점에 고정된다 (진행 중 목표가 움직이면 안 됨) */
export function missionTarget(state: GameState, index: number): number {
  return state.missions.targets[index] ?? 1;
}

export function missionDef(id: string): MissionDef | undefined {
  return MISSION_BY_ID[id];
}

export function bumpMission(state: GameState, event: MissionEvent, amount: number): void {
  state.missions.ids.forEach((id, i) => {
    const def = MISSION_BY_ID[id];
    if (def && def.event === event) state.missions.progress[i] += amount;
  });
}

export function missionComplete(state: GameState, index: number): boolean {
  if (!state.missions.ids[index]) return false;
  return state.missions.progress[index] >= missionTarget(state, index);
}

export function allMissionsClaimed(state: GameState): boolean {
  return state.missions.ids.length > 0 && state.missions.claimed.every(Boolean);
}
