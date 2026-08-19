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

/** 하루 기준 시각 04:00 (기획서 세이브 3장) */
export function todayKey(now = Date.now()): string {
  const d = new Date(now - 4 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyBusiness(def: (typeof BUSINESSES)[number], firstUnitOpen = false): BusinessState {
  return {
    units: def.units.map((_, i) => ({
      unlocked: i === 0 && firstUnitOpen,
      level: i === 0 && firstUnitOpen ? 1 : 0,
      progress: 0,
      running: false,
      equip: false,
      manager: false,
    })),
    boostUntil: 0,
    trialUntil: 0,
    hoistLevel: 1,
    totalProduced: 0,
  };
}

export function emptyFacilities(): Record<string, FacilityState> {
  const out: Record<string, FacilityState> = {};
  for (const f of FACILITIES) out[f.id] = { unlocked: false, level: 0 };
  return out;
}

export function emptyMinigames(): Record<string, MinigameState> {
  const out: Record<string, MinigameState> = {};
  for (const b of BUSINESSES) {
    out[b.id] = { day: '', plays: 0, adPlays: 0, bestRate: 0, boostUntil: 0, boostMult: 1 };
  }
  return out;
}

export function emptyCollection(): CollectionState {
  return { specs: 0, satisfaction: 0, funds: 0, fish: [], seenTiers: {} };
}

export function createInitialState(now = Date.now()): GameState {
  const businesses = {} as Record<BusinessId, BusinessState>;
  for (const def of BUSINESSES) businesses[def.id] = emptyBusiness(def, def.id === 'mine');
  const resources: Record<ResourceId, number> = {
    cash: CONFIG.startCash,
    material: CONFIG.startMaterial,
    ore: 0,
    goods: 0,
    food: 0,
    pop: 0,
    gem: 0,
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
    nextEventAt: now + CONFIG.events.graceSeconds * 1000,
    collection: emptyCollection(),
    city: { level: 1, taxRun: 0, taxTotal: 0, capLevel: 0, effLevel: 0, pop: CONFIG.facility.popBase },
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
 * 재개발 리셋 (기획서 세이브 4장).
 * 초기화: 자금·물자·도시·사업·시설
 * 유지  : 보석·설계도·프레스티지·도감·상점·설정·통계·오프라인 업그레이드
 */
export function applyPrestigeReset(state: GameState, gained: number, now = Date.now()): void {
  const up = state.prestige.upgrades;
  const keepManagers = up['keep_manager'] ?? 0;
  const fundLevel = up['start_fund'] ?? 0;

  // 유지할 매니저를 앞에서부터 고른다
  const kept: { biz: BusinessId; index: number }[] = [];
  for (const def of BUSINESSES) {
    state.businesses[def.id].units.forEach((u, i) => {
      if (u.manager) kept.push({ biz: def.id, index: i });
    });
  }
  kept.splice(keepManagers);

  for (const def of BUSINESSES) {
    state.businesses[def.id] = emptyBusiness(def, def.id === 'mine');
  }
  for (const k of kept) {
    const u = state.businesses[k.biz].units[k.index];
    if (u) u.manager = true;
  }

  state.resources.cash = fundLevel > 0 ? CONFIG.startCash * Math.pow(10, fundLevel) : CONFIG.startCash;
  state.resources.material = CONFIG.startMaterial;
  state.resources.ore = 0;
  state.resources.goods = 0;
  state.resources.food = 0;
  state.resources.pop = 0;
  state.resources.blueprint += gained;

  state.facilities = emptyFacilities();
  state.events = [];
  state.city = {
    level: 1,
    taxRun: 0,
    taxTotal: state.city.taxTotal,
    capLevel: state.city.capLevel,
    effLevel: state.city.effLevel,
    pop: CONFIG.facility.popBase,
  };
  state.prestige.blueprints += gained;
  state.prestige.count += 1;
  state.prestige.lastAt = now;
  state.stats.cashEarnedRun = 0;
  state.lastSeen = now;
}

/** 세이브 마이그레이션 */
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
    flags: { ...base.flags, ...(loaded.flags ?? {}) },
    adCooldowns: { ...base.adCooldowns, ...(loaded.adCooldowns ?? {}) },
    businesses: { ...base.businesses },
    facilities: { ...base.facilities },
    minigames: { ...base.minigames },
    events: loaded.events ?? [],
    nextEventAt: loaded.nextEventAt ?? Date.now() + CONFIG.events.graceSeconds * 1000,
    collection: { ...base.collection, ...(loaded.collection ?? {}) },
  };

  for (const def of BUSINESSES) {
    const saved = loaded.businesses?.[def.id];
    const fresh = emptyBusiness(def, def.id === 'mine');
    merged.businesses[def.id] = {
      boostUntil: saved?.boostUntil ?? 0,
      trialUntil: saved?.trialUntil ?? 0,
      hoistLevel: Math.max(1, saved?.hoistLevel ?? 1),
      totalProduced: saved?.totalProduced ?? 0,
      units: def.units.map((_, i) => {
        const su = saved?.units?.[i];
        if (!su) return fresh.units[i];
        return {
          unlocked: su.unlocked ?? su.level > 0,
          level: su.level ?? 0,
          progress: su.progress ?? 0,
          running: su.running ?? false,
          equip: su.equip ?? false,
          manager: su.manager ?? false,
        };
      }),
    };
  }
  for (const f of FACILITIES) {
    const saved = loaded.facilities?.[f.id];
    merged.facilities[f.id] = { unlocked: saved?.unlocked ?? false, level: saved?.level ?? 0 };
  }
  for (const b of BUSINESSES) {
    const saved = loaded.minigames?.[b.id];
    merged.minigames[b.id] = {
      day: saved?.day ?? '',
      plays: saved?.plays ?? 0,
      adPlays: saved?.adPlays ?? 0,
      bestRate: saved?.bestRate ?? 0,
      boostUntil: saved?.boostUntil ?? 0,
      boostMult: saved?.boostMult ?? 1,
    };
  }
  merged.version = CONFIG.saveVersion;
  return merged;
}
