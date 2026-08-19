import { BUSINESSES } from '../data/businesses';
import { FACILITIES } from '../data/buildings';
import { CONFIG } from '../data/config';
import type {
  BusinessId,
  BusinessState,
  CollectionState,
  FacilityState,
  GameState,
  MinigameState,
  ResourceId,
} from './types';

/** 기기 로컬 자정 기준 날짜 키 */
export function todayKey(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyBusiness(def: (typeof BUSINESSES)[number], firstUnitLevel = 0): BusinessState {
  return {
    units: def.units.map((_, i) => ({
      level: i === 0 ? firstUnitLevel : 0,
      progress: 0,
      running: false,
      equip: false,
      manager: false,
    })),
    boostUntil: 0,
    trialUntil: 0,
    totalProduced: 0,
  };
}

export function emptyFacilities(): Record<string, FacilityState> {
  const out: Record<string, FacilityState> = {};
  for (const f of FACILITIES) {
    out[f.id] = { built: false, tracks: Object.fromEntries(f.tracks.map((t) => [t.id, 0])) };
  }
  return out;
}

export function emptyMinigames(): Record<string, MinigameState> {
  const out: Record<string, MinigameState> = {};
  for (const b of BUSINESSES) {
    out[b.id] = { day: '', plays: 0, bestScore: 0, boostUntil: 0, boostMult: 1 };
  }
  return out;
}

export function emptyCollection(): CollectionState {
  return { gems: 0, specs: 0, satisfaction: 0, funds: 0, fish: [], seenTiers: {} };
}

export function createInitialState(now = Date.now()): GameState {
  const businesses = {} as Record<BusinessId, BusinessState>;
  for (const def of BUSINESSES) {
    businesses[def.id] = emptyBusiness(def, def.id === 'mine' ? 1 : 0);
  }
  const resources: Record<ResourceId, number> = {
    cash: CONFIG.startCash,
    material: CONFIG.startMaterial,
    ore: 0,
    goods: 0,
    food: 0,
    pop: 0,
    blueprint: 0,
  };
  return {
    version: CONFIG.saveVersion,
    lastSeen: now,
    timeSkew: 0,
    resources,
    businesses,
    facilities: emptyFacilities(),
    minigames: emptyMinigames(),
    events: [],
    nextEventAt: now + 10 * 60 * 1000,
    collection: emptyCollection(),
    city: { level: 1, taxRun: 0, taxTotal: 0, storageLevel: 0, logisticsLevel: 0, pop: 0 },
    prestige: { blueprints: 0, upgrades: {}, count: 0, lastAt: now },
    missions: { day: '', ids: [], targets: [], progress: [], claimed: [] },
    attendance: { day: '', streak: 0, claimedToday: false },
    settings: { notation: 'short', textScale: 1, reducedMotion: false, haptics: true, sound: true },
    shop: { adFree: false, piggyValue: 0, piggyBought: 0, purchases: [], firstPurchaseDone: false },
    stats: {
      cashEarnedRun: 0,
      cashEarnedTotal: 0,
      playSeconds: 0,
      adsWatched: 0,
      taps: 0,
      startedAt: now,
    },
    flags: {},
    adCooldowns: {},
  };
}

/**
 * 재개발(프레스티지) 리셋.
 * 유지: 설계도, 누적 세수, 상점/설정/통계 일부, 도감성 플래그
 */
export function applyPrestigeReset(state: GameState, gainedBlueprints: number, now = Date.now()): void {
  const up = state.prestige.upgrades;
  const startLevel = up['startLevel'] ?? 0;
  const keepManagers = (up['keepManagers'] ?? 0) > 0;
  const cashLevel = up['startCash'] ?? 0;
  const prevManagers: Record<string, boolean[]> = {};
  for (const def of BUSINESSES) {
    prevManagers[def.id] = state.businesses[def.id].units.map((u) => u.manager);
  }

  for (const def of BUSINESSES) {
    const fresh = emptyBusiness(def, def.id === 'mine' ? Math.max(1, startLevel) : 0);
    if (def.id === 'mine' && startLevel > 0) {
      fresh.units = fresh.units.map((u) => ({ ...u, level: Math.max(u.level, startLevel) }));
    }
    if (keepManagers) {
      fresh.units.forEach((u, i) => {
        u.manager = prevManagers[def.id][i] ?? false;
      });
    }
    state.businesses[def.id] = fresh;
  }

  state.resources.cash = cashLevel > 0 ? 1000 * Math.pow(9, cashLevel - 1) : CONFIG.startCash;
  state.resources.material = CONFIG.startMaterial;
  state.resources.ore = 0;
  state.resources.goods = 0;
  state.resources.food = 0;
  state.resources.pop = 0;
  state.resources.blueprint += gainedBlueprints;

  const keepFacilities = (up['keepFacilities'] ?? 0) > 0;
  if (!keepFacilities) state.facilities = emptyFacilities();
  state.events = [];
  state.city = {
    level: 1,
    taxRun: 0,
    taxTotal: state.city.taxTotal,
    storageLevel: 0,
    logisticsLevel: 0,
    pop: 0,
  };
  state.prestige.blueprints += gainedBlueprints;
  state.prestige.count += 1;
  state.prestige.lastAt = now;
  state.stats.cashEarnedRun = 0;
  state.lastSeen = now;
}

/** 세이브 마이그레이션. 필드가 늘어나면 여기서 채운다. */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const base = createInitialState();
  const loaded = raw as Partial<GameState>;
  const merged: GameState = {
    ...base,
    ...loaded,
    resources: { ...base.resources, ...(loaded.resources ?? {}) },
    city: { ...base.city, ...(loaded.city ?? {}) },
    prestige: { ...base.prestige, ...(loaded.prestige ?? {}) },
    missions: { ...base.missions, ...(loaded.missions ?? {}) },
    attendance: { ...base.attendance, ...(loaded.attendance ?? {}) },
    settings: { ...base.settings, ...(loaded.settings ?? {}) },
    shop: { ...base.shop, ...(loaded.shop ?? {}) },
    stats: { ...base.stats, ...(loaded.stats ?? {}) },
    facilities: { ...base.facilities },
    minigames: { ...base.minigames },
    events: loaded.events ?? [],
    nextEventAt: loaded.nextEventAt ?? Date.now() + 600_000,
    collection: { ...base.collection, ...(loaded.collection ?? {}) },
    flags: { ...base.flags, ...(loaded.flags ?? {}) },
    adCooldowns: { ...base.adCooldowns, ...(loaded.adCooldowns ?? {}) },
    businesses: { ...base.businesses },
  };
  // 사업/유닛이 추가되어도 기존 세이브가 깨지지 않도록 유닛 배열 길이를 맞춘다
  for (const def of BUSINESSES) {
    const saved = loaded.businesses?.[def.id];
    const fresh = emptyBusiness(def, def.id === 'mine' ? 1 : 0);
    if (!saved) {
      merged.businesses[def.id] = fresh;
      continue;
    }
    merged.businesses[def.id] = {
      boostUntil: saved.boostUntil ?? 0,
      trialUntil: saved.trialUntil ?? 0,
      totalProduced: saved.totalProduced ?? 0,
      units: def.units.map((_, i) => saved.units?.[i] ?? fresh.units[i]),
    };
  }
  for (const f of FACILITIES) {
    const saved = loaded.facilities?.[f.id];
    merged.facilities[f.id] = {
      built: saved?.built ?? false,
      tracks: Object.fromEntries(f.tracks.map((t) => [t.id, saved?.tracks?.[t.id] ?? 0])),
    };
  }
  for (const b of BUSINESSES) {
    const saved = loaded.minigames?.[b.id];
    merged.minigames[b.id] = {
      day: saved?.day ?? '',
      plays: saved?.plays ?? 0,
      bestScore: saved?.bestScore ?? 0,
      boostUntil: saved?.boostUntil ?? 0,
      boostMult: saved?.boostMult ?? 1,
    };
  }
  merged.version = CONFIG.saveVersion;
  return merged;
}
