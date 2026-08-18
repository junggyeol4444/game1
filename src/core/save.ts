import { CONFIG } from '../data/config';
import { createInitialState, migrate } from './state';
import type { GameState } from './types';

/**
 * 시간 소스. 오프라인 수익은 서버 시간으로 검증하는 것이 원칙이라
 * 여기 한 곳만 교체하면 서버 시간으로 전환된다.
 * (프로토타입은 기기 시간 + 역행 감지)
 */
export interface TimeSource {
  now(): number;
}

export const deviceTime: TimeSource = { now: () => Date.now() };

let timeSource: TimeSource = deviceTime;
export function setTimeSource(src: TimeSource): void {
  timeSource = src;
}
export function now(): number {
  return timeSource.now();
}

const KEY = CONFIG.saveKey;

export function save(state: GameState): void {
  state.lastSeen = now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('저장 실패', e);
  }
}

export function load(): { state: GameState; elapsedSeconds: number; fresh: boolean } {
  const t = now();
  let raw: unknown = null;
  try {
    const text = localStorage.getItem(KEY);
    if (text) raw = JSON.parse(text);
  } catch (e) {
    console.warn('세이브 파싱 실패', e);
  }
  const migrated = raw ? migrate(raw) : null;
  if (!migrated) return { state: createInitialState(t), elapsedSeconds: 0, fresh: true };

  let elapsed = (t - migrated.lastSeen) / 1000;
  if (elapsed < 0) {
    // 기기 시간을 되돌린 경우: 보상 없음. 누적 skew 로 기록해 둔다.
    migrated.timeSkew += -elapsed;
    elapsed = 0;
  }
  // 30일 이상은 상한 계산에서 어차피 잘리지만 표시가 이상해지므로 클램프
  elapsed = Math.min(elapsed, 30 * 86400);
  return { state: migrated, elapsedSeconds: elapsed, fresh: false };
}

export function wipe(): void {
  localStorage.removeItem(KEY);
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text: string): GameState | null {
  try {
    return migrate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))));
  } catch {
    return null;
  }
}
