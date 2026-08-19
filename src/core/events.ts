import { BUSINESSES } from '../data/businesses';
import { CONFIG } from '../data/config';
import { isUnlocked, stats, totalCashPerSecond } from './economy';
import type { BusinessId, CityEvent, GameState } from './types';

export interface EventNotice {
  text: string;
  kind: 'fire' | 'theft' | 'blocked';
  target?: string;
}

function candidates(state: GameState): BusinessId[] {
  return BUSINESSES.filter(
    (b) => isUnlocked(state, b) && state.businesses[b.id].units.some((u) => u.level > 0),
  ).map((b) => b.id);
}

export function activeEvent(state: GameState, target: string, now = Date.now()): CityEvent | null {
  return state.events.find((e) => e.target === target && e.until > now) ?? null;
}

export function hasActiveEvents(state: GameState, now = Date.now()): boolean {
  return state.events.some((e) => e.until > now);
}

/**
 * 사고 / 도난.
 * 소방서·경찰서가 없으면 그냥 맞는다. 지으면 확률과 피해가 줄어든다.
 */
export function tickEvents(state: GameState, now = Date.now()): EventNotice[] {
  const notices: EventNotice[] = [];
  const before = state.events.length;
  state.events = state.events.filter((e) => e.until > now);
  if (state.events.length !== before) {
    // 진압/복구 완료
  }

  const C = CONFIG.events;
  if (state.city.level < C.startCityLevel) {
    state.nextEventAt = Math.max(state.nextEventAt, now + C.graceSeconds * 1000);
    return notices;
  }
  if (now < state.nextEventAt) return notices;

  const cs = stats(state);
  state.nextEventAt = now + C.intervalSeconds * 1000 * (0.7 + Math.random() * 0.6);

  const pool = candidates(state);
  if (pool.length === 0) return notices;
  const target = pool[Math.floor(Math.random() * pool.length)];
  const def = BUSINESSES.find((b) => b.id === target)!;

  if (Math.random() < 0.55) {
    // 화재
    if (Math.random() > cs.accidentMult) return notices; // 소방서가 예방
    state.events.push({
      id: `fire-${now}`,
      kind: 'fire',
      target,
      until: now + C.fireSeconds * 1000,
      severity: C.fireSeverity,
    });
    notices.push({ kind: 'fire', target, text: `🔥 ${def.name}에 화재! 소방차 출동` });
  } else {
    // 도난
    if (Math.random() < cs.lossPrevent) {
      notices.push({ kind: 'blocked', target, text: `👮 ${def.name} 도난 시도를 경찰이 차단했습니다` });
      return notices;
    }
    const loss = totalCashPerSecond(state, now) * C.theftSeconds * (1 - cs.lossPrevent);
    const taken = Math.min(state.resources.cash, loss);
    state.resources.cash -= taken;
    state.events.push({
      id: `theft-${now}`,
      kind: 'theft',
      target,
      until: now + 20_000,
      severity: 0,
    });
    notices.push({ kind: 'theft', target, text: `🚨 ${def.name} 도난 발생` });
  }
  return notices;
}
