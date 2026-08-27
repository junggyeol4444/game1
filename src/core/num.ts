// 큰 숫자 표기. 방치형은 후반에 1e30 이상을 다루므로 표기 규칙을 한 곳에 고정한다.
// 내부 연산은 double(최대 ~1.8e308). 그 이상이 필요해지면 여기만 Decimal 구현으로 교체한다.

export type NotationMode = 'short' | 'scientific';

const SUFFIX_BASE = ['', 'K', 'M', 'B', 'T'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** 1e3 단위 계단: K M B T aa ab ... az ba ... */
function suffixFor(tier: number): string {
  if (tier < SUFFIX_BASE.length) return SUFFIX_BASE[tier];
  const i = tier - SUFFIX_BASE.length;
  const first = Math.floor(i / 26);
  const second = i % 26;
  return LETTERS[first] + LETTERS[second];
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function formatNumber(v: number, mode: NotationMode = 'short', decimals = 2): string {
  if (!isFinite(v)) return '∞';
  if (v === 0) return '0';
  const neg = v < 0;
  const n = Math.abs(v);
  let out: string;

  if (n < 1) {
    out = trimZeros(n.toFixed(Math.min(3, decimals + 1)));
  } else if (mode === 'scientific' && n >= 1e6) {
    const e = Math.floor(Math.log10(n));
    out = `${trimZeros((n / Math.pow(10, e)).toFixed(decimals))}e${e}`;
  } else if (n < 1000) {
    out = trimZeros(n.toFixed(n < 10 ? decimals : n < 100 ? 1 : 0));
  } else {
    let tier = Math.floor(Math.log10(n) / 3);
    let scaled = Number((n / Math.pow(1000, tier)).toFixed(decimals));
    // 반올림 자리 넘김: 999,999 는 '1000K' 가 아니라 '1M' 이다
    if (scaled >= 1000) {
      tier += 1;
      scaled = Number((n / Math.pow(1000, tier)).toFixed(decimals));
    }
    out = `${trimZeros(scaled.toFixed(decimals))}${suffixFor(tier)}`;
  }
  return neg ? `-${out}` : out;
}

/** 정수 표기(레벨, 개수 등) */
export function formatInt(v: number, mode: NotationMode = 'short'): string {
  if (Math.abs(v) < 100000) return Math.floor(v).toLocaleString('ko-KR');
  return formatNumber(Math.floor(v), mode, 2);
}

/** 초 -> "2시간 13분" 같은 한국어 표기 */
export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '-';
  const s = Math.floor(sec);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 ${s % 60}초`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
}

/** 시:분:초 (타이머용) */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 등비 비용 합계: base * growth^level 을 count개 살 때의 총액.
 * 방치형의 x10 / Max 구매에 필수.
 */
export function geometricCost(base: number, growth: number, ownedLevel: number, count: number): number {
  if (count <= 0) return 0;
  const first = base * Math.pow(growth, ownedLevel);
  if (growth === 1) return first * count;
  return (first * (Math.pow(growth, count) - 1)) / (growth - 1);
}

/**
 * 주어진 예산으로 살 수 있는 최대 개수.
 *
 * 유한한 값만 돌려준다. 예산이 Infinity/NaN 이면 0 이다 —
 * 그대로 흘리면 유닛 레벨이 Infinity 가 되어 세이브가 영구히 망가진다.
 * (자금이 무한대인 상태는 이미 비정상이므로 '살 수 없다' 가 안전한 답이다)
 */
export function maxAffordable(base: number, growth: number, ownedLevel: number, budget: number): number {
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  const first = base * Math.pow(growth, ownedLevel);
  if (!Number.isFinite(first) || first <= 0 || budget < first) return 0;
  if (growth === 1) return Math.floor(budget / first);
  const n = Math.log((budget * (growth - 1)) / first + 1) / Math.log(growth);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n + 1e-9));
}

/**
 * 결제 가능 판정. 모든 구매가 이걸 통과해야 한다.
 *
 * `보유 < 비용` 만 보면 안 된다 — 보유가 NaN 이면 비교가 false 라 **공짜로 사진다**.
 * 보유가 Infinity 인 상태도 이미 비정상이므로 막는다.
 */
export function canAfford(have: number, cost: number): boolean {
  return Number.isFinite(have) && Number.isFinite(cost) && cost >= 0 && have >= cost;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
