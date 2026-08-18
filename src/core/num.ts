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
    const tier = Math.floor(Math.log10(n) / 3);
    const scaled = n / Math.pow(1000, tier);
    // 부동소수 오차로 999.999 -> 1000 이 되는 경우 방지
    if (scaled >= 1000) return formatNumber(neg ? -n * 1.0000001 : n * 1.0000001, mode, decimals);
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

/** 주어진 예산으로 살 수 있는 최대 개수 */
export function maxAffordable(base: number, growth: number, ownedLevel: number, budget: number): number {
  if (budget <= 0) return 0;
  const first = base * Math.pow(growth, ownedLevel);
  if (budget < first) return 0;
  if (growth === 1) return Math.floor(budget / first);
  const n = Math.log((budget * (growth - 1)) / first + 1) / Math.log(growth);
  return Math.max(0, Math.floor(n + 1e-9));
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
