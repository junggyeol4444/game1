import { BUSINESSES } from '../data/businesses';
import { FACILITIES } from '../data/buildings';
import { CONFIG } from '../data/config';
import { MAX_ERA, eraDef } from '../data/eras';
import { createInitialState, migrate } from './state';
import type { GameState } from './types';

/**
 * 세이브 (기획서 '세이브 데이터').
 * JSON -> 문서 스키마로 직렬화 -> 체크섬 -> 난독화 -> localStorage.
 * 백업 1개를 항상 보관하고, 체크섬이 깨지면 백업으로 복구한다.
 *
 * ※ 웹 빌드에서는 진짜 암호화가 의미 없으므로 난독화 + 체크섬까지만 한다.
 *   네이티브(Capacitor) 빌드에서 기기 키 기반 암호화로 교체할 것 — docs/NATIVE.md
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
const BACKUP_KEY = `${KEY}-backup`;
const OBFUSCATE = 0x5a;

const big = (v: number) => String(v);
const num = (v: unknown, d = 0) => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : d;
};

/** FNV-1a 체크섬 */
function checksum(text: string): string {
  let hSum = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hSum ^= text.charCodeAt(i);
    hSum = Math.imul(hSum, 16777619);
  }
  return (hSum >>> 0).toString(36);
}

function encode(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += String.fromCharCode(text.charCodeAt(i) ^ OBFUSCATE);
  return btoa(unescape(encodeURIComponent(out)));
}

function decode(blob: string): string {
  const raw = decodeURIComponent(escape(atob(blob)));
  let out = '';
  for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ OBFUSCATE);
  return out;
}

/**
 * 도감 키를 `시대id:건물id` 로 옮긴다.
 * 시대 구분이 없던 세이브는 키에 ':' 이 없다 — 그때 서 있던 시대 것으로 본다.
 */
function migrateSeenTiers(raw: Record<string, number>, era: number): Record<string, number> {
  const eraId = eraDef(era).id;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    out[k.includes(':') ? k : `${eraId}:${k}`] = num(v, 0);
  }
  return out;
}

// ── 문서 스키마 직렬화 ──────────────────────────────────────
export function serialize(state: GameState): Record<string, unknown> {
  return {
    version: CONFIG.saveVersion,
    player: {
      id: '',
      name: '',
      created_at: state.stats.startedAt,
      last_save_at: now(),
      last_online_at: state.lastSeen,
      play_seconds: Math.round(state.stats.playSeconds),
      tutorial_step: state.tutorial,
    },
    currency: {
      money: big(state.resources.cash),
      material: big(state.resources.material),
      gem: state.resources.gem,
      blueprint: state.resources.blueprint,
    },
    city: {
      era: state.era,
      era_id: eraDef(state.era).id,
      level: state.city.level,
      total_tax: big(state.city.taxTotal),
      run_tax: big(state.city.taxRun),
      population: state.city.pop,
      cap_level: state.city.capLevel,
      eff_level: state.city.effLevel,
    },
    resources: {
      ore: big(state.resources.ore),
      goods: big(state.resources.goods),
      food: big(state.resources.food),
      pop: big(state.resources.pop),
    },
    business: Object.fromEntries(
      BUSINESSES.map((def) => {
        const bs = state.businesses[def.id];
        return [
          def.id,
          {
            unlocked: state.city.level >= def.unlockCityLevel,
            units: bs.units.map((u, i) => ({
              index: i + 1,
              unlocked: u.unlocked,
              level: u.level,
              equip: u.equip,
              manager: u.manager,
              cycle_progress: Number(u.progress.toFixed(3)),
            })),
            elevator_level: bs.hoistLevel,
            total_level: bs.units.reduce((a, u) => a + u.level, 0),
            boost_until: bs.boostUntil,
            trial_until: bs.trialUntil,
            total_produced: big(bs.totalProduced),
          },
        ];
      }),
    ),
    facility: Object.fromEntries(
      FACILITIES.map((f) => [f.id, { unlocked: state.facilities[f.id]?.unlocked ?? false, level: state.facilities[f.id]?.level ?? 0 }]),
    ),
    offline: { efficiency_level: state.city.effLevel, cap_level: state.city.capLevel },
    prestige: {
      count: state.prestige.count,
      total_blueprint_earned: state.prestige.blueprints,
      last_at: state.prestige.lastAt,
      upgrades: state.prestige.upgrades,
    },
    minigame: Object.fromEntries(
      BUSINESSES.map((def) => {
        const m = state.minigames[def.id];
        return [
          def.id,
          {
            date: m.day,
            plays_today: m.plays,
            ad_plays_today: m.adPlays,
            best_rate: m.bestRate,
            boost_until: m.boostUntil,
            boost_mult: m.boostMult,
          },
        ];
      }),
    ),
    collection: {
      fish: state.collection.fish,
      rides: state.collection.rides,
      building: state.collection.seenTiers,
      equipment: { specs: state.collection.specs, satisfaction: state.collection.satisfaction, funds: state.collection.funds },
    },
    mission: {
      date: state.missions.day,
      daily: state.missions.ids.map((id, i) => ({
        id,
        progress: state.missions.progress[i] ?? 0,
        goal: state.missions.targets[i] ?? 1,
        claimed: state.missions.claimed[i] ?? false,
      })),
      login_streak: state.attendance.streak,
      login_claimed_today: state.attendance.claimedToday,
      login_date: state.attendance.day,
    },
    shop: {
      no_ads: state.shop.adFree,
      piggy_amount: state.shop.piggyValue,
      piggy_bought: state.shop.piggyBought,
      purchased: state.shop.purchases,
      first_purchase: state.shop.firstPurchaseDone,
    },
    settings: {
      bgm: state.settings.sound,
      sfx: state.settings.sound,
      haptic: state.settings.haptics,
      font_size: state.settings.textScale,
      notation: state.settings.notation,
      reduced_motion: state.settings.reducedMotion,
      language: 'ko',
    },
    stats: {
      total_taps: state.stats.taps,
      total_ads_watched: state.stats.adsWatched,
      cash_earned_run: big(state.stats.cashEarnedRun),
      cash_earned_total: big(state.stats.cashEarnedTotal),
    },
    runtime: {
      events: state.events,
      next_event_at: state.nextEventAt,
      ad_cooldowns: state.adCooldowns,
      flags: state.flags,
      time_skew: state.timeSkew,
    },
  };
}

export function deserialize(raw: Record<string, unknown>): GameState {
  const s = createInitialState();
  const g = <T,>(o: unknown, k: string, d: T): T => {
    const v = (o as Record<string, unknown> | undefined)?.[k];
    return (v === undefined ? d : v) as T;
  };
  const player = raw.player as Record<string, unknown> | undefined;
  const cur = raw.currency as Record<string, unknown> | undefined;
  const city = raw.city as Record<string, unknown> | undefined;
  const res = raw.resources as Record<string, unknown> | undefined;

  s.stats.startedAt = g(player, 'created_at', s.stats.startedAt);
  s.lastSeen = g(player, 'last_save_at', s.lastSeen);
  s.stats.playSeconds = g(player, 'play_seconds', 0);
  s.tutorial = num(g(player, 'tutorial_step', -1), -1);

  s.resources.cash = num(g(cur, 'money', 0), CONFIG.startCash);
  s.resources.material = num(g(cur, 'material', 0));
  s.resources.gem = num(g(cur, 'gem', 0));
  s.resources.blueprint = num(g(cur, 'blueprint', 0));
  s.resources.ore = num(g(res, 'ore', 0));
  s.resources.goods = num(g(res, 'goods', 0));
  s.resources.food = num(g(res, 'food', 0));
  s.resources.pop = num(g(res, 'pop', 0));

  s.era = Math.max(0, Math.min(MAX_ERA, num(g(city, 'era', 0))));
  s.city.level = g(city, 'level', 1);
  s.city.taxTotal = num(g(city, 'total_tax', 0));
  s.city.taxRun = num(g(city, 'run_tax', 0));
  s.city.pop = num(g(city, 'population', 0));
  s.city.capLevel = g(city, 'cap_level', 0);
  s.city.effLevel = g(city, 'eff_level', 0);

  const biz = raw.business as Record<string, Record<string, unknown>> | undefined;
  for (const def of BUSINESSES) {
    const b = biz?.[def.id];
    if (!b) continue;
    const bs = s.businesses[def.id];
    bs.hoistLevel = Math.max(1, num(b['elevator_level'], 1));
    bs.boostUntil = num(b['boost_until'], 0);
    bs.trialUntil = num(b['trial_until'], 0);
    bs.totalProduced = num(b['total_produced'], 0);
    const units = (b['units'] as Record<string, unknown>[] | undefined) ?? [];
    units.forEach((u, i) => {
      if (i >= bs.units.length) return;
      bs.units[i] = {
        unlocked: Boolean(u['unlocked']),
        level: num(u['level'], 0),
        progress: num(u['cycle_progress'], 0),
        running: false,
        equip: Boolean(u['equip']),
        manager: Boolean(u['manager']),
      };
    });
  }

  const fac = raw.facility as Record<string, Record<string, unknown>> | undefined;
  for (const f of FACILITIES) {
    const v = fac?.[f.id];
    s.facilities[f.id] = { unlocked: Boolean(v?.['unlocked']), level: num(v?.['level'], 0) };
  }

  const pres = raw.prestige as Record<string, unknown> | undefined;
  s.prestige.count = g(pres, 'count', 0);
  s.prestige.blueprints = g(pres, 'total_blueprint_earned', 0);
  s.prestige.lastAt = g(pres, 'last_at', Date.now());
  s.prestige.upgrades = g(pres, 'upgrades', {} as Record<string, number>);

  const mg = raw.minigame as Record<string, Record<string, unknown>> | undefined;
  for (const def of BUSINESSES) {
    const m = mg?.[def.id];
    if (!m) continue;
    s.minigames[def.id] = {
      day: String(m['date'] ?? ''),
      plays: num(m['plays_today'], 0),
      adPlays: num(m['ad_plays_today'], 0),
      bestRate: num(m['best_rate'], 0),
      boostUntil: num(m['boost_until'], 0),
      boostMult: num(m['boost_mult'], 1),
    };
  }

  const col = raw.collection as Record<string, unknown> | undefined;
  s.collection.fish = g(col, 'fish', [] as string[]);
  s.collection.rides = g(col, 'rides', [] as string[]);
  s.collection.seenTiers = migrateSeenTiers(g(col, 'building', {} as Record<string, number>), s.era);
  const eq = g(col, 'equipment', {} as Record<string, number>);
  s.collection.specs = num(eq['specs'], 0);
  s.collection.satisfaction = num(eq['satisfaction'], 0);
  s.collection.funds = num(eq['funds'], 0);

  const mis = raw.mission as Record<string, unknown> | undefined;
  const daily = g(mis, 'daily', [] as Record<string, unknown>[]);
  s.missions = {
    day: g(mis, 'date', ''),
    ids: daily.map((d) => String(d['id'])),
    targets: daily.map((d) => num(d['goal'], 1)),
    progress: daily.map((d) => num(d['progress'], 0)),
    claimed: daily.map((d) => Boolean(d['claimed'])),
  };
  s.attendance = {
    day: g(mis, 'login_date', ''),
    streak: g(mis, 'login_streak', 0),
    claimedToday: g(mis, 'login_claimed_today', false),
  };

  const shop = raw.shop as Record<string, unknown> | undefined;
  s.shop = {
    adFree: g(shop, 'no_ads', false),
    piggyValue: num(g(shop, 'piggy_amount', 0)),
    piggyBought: g(shop, 'piggy_bought', 0),
    purchases: g(shop, 'purchased', [] as string[]),
    firstPurchaseDone: g(shop, 'first_purchase', false),
  };

  const set = raw.settings as Record<string, unknown> | undefined;
  s.settings = {
    notation: g(set, 'notation', 'short') as 'short' | 'scientific',
    textScale: g(set, 'font_size', 1) as 1 | 1.15 | 1.3,
    reducedMotion: g(set, 'reduced_motion', false),
    haptics: g(set, 'haptic', true),
    sound: g(set, 'bgm', true),
  };

  const st = raw.stats as Record<string, unknown> | undefined;
  s.stats.taps = g(st, 'total_taps', 0);
  s.stats.adsWatched = g(st, 'total_ads_watched', 0);
  s.stats.cashEarnedRun = num(g(st, 'cash_earned_run', 0));
  s.stats.cashEarnedTotal = num(g(st, 'cash_earned_total', 0));

  const rt = raw.runtime as Record<string, unknown> | undefined;
  s.events = g(rt, 'events', []);
  s.nextEventAt = g(rt, 'next_event_at', Date.now() + CONFIG.events.graceSeconds * 1000);
  s.adCooldowns = g(rt, 'ad_cooldowns', {} as Record<string, number>);
  s.flags = g(rt, 'flags', {} as Record<string, boolean>);
  s.timeSkew = g(rt, 'time_skew', 0);

  return migrate(s) ?? s;
}

// ── 저장 / 로드 ─────────────────────────────────────────────
function writeSlot(key: string, payload: string): void {
  try {
    localStorage.setItem(key, payload);
  } catch (e) {
    console.warn('저장 실패', e);
  }
}

export function save(state: GameState): void {
  state.lastSeen = now();
  const body = JSON.stringify(serialize(state));
  const envelope = JSON.stringify({ c: checksum(body), d: body });
  const payload = encode(envelope);
  // 직전 저장본을 백업으로 밀어 둔다
  const prev = localStorage.getItem(KEY);
  if (prev) writeSlot(BACKUP_KEY, prev);
  writeSlot(KEY, payload);
}

function readSlot(key: string): Record<string, unknown> | null {
  try {
    const blob = localStorage.getItem(key);
    if (!blob) return null;
    const env = JSON.parse(decode(blob)) as { c: string; d: string };
    if (!env?.d || checksum(env.d) !== env.c) {
      console.warn(`세이브 체크섬 불일치: ${key}`);
      return null;
    }
    return JSON.parse(env.d) as Record<string, unknown>;
  } catch (e) {
    console.warn('세이브 읽기 실패', key, e);
    return null;
  }
}

export interface LoadResult {
  state: GameState;
  elapsedSeconds: number;
  fresh: boolean;
  /** 백업으로 복구되었는가 */
  recovered: boolean;
}

export function load(): LoadResult {
  const t = now();
  let recovered = false;
  let raw = readSlot(KEY);
  if (!raw) {
    raw = readSlot(BACKUP_KEY);
    if (raw) recovered = true;
  }
  if (!raw) return { state: createInitialState(t), elapsedSeconds: 0, fresh: true, recovered: false };

  let state: GameState;
  try {
    state = deserialize(raw);
  } catch (e) {
    console.warn('마이그레이션 실패 — 새로 시작', e);
    return { state: createInitialState(t), elapsedSeconds: 0, fresh: true, recovered: false };
  }

  // 시간 검증: 마지막 저장보다 과거면 경과 0
  let elapsed = (t - state.lastSeen) / 1000;
  if (elapsed < 0) {
    state.timeSkew += -elapsed;
    elapsed = 0;
  }
  elapsed = Math.min(elapsed, 30 * 86400);
  return { state, elapsedSeconds: elapsed, fresh: false, recovered };
}

export function wipe(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(BACKUP_KEY);
}

export function exportSave(state: GameState): string {
  return encode(JSON.stringify(serialize(state)));
}

export function importSave(text: string): GameState | null {
  try {
    return deserialize(JSON.parse(decode(text.trim())));
  } catch {
    return null;
  }
}
