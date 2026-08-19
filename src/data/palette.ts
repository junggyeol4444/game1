/**
 * 아트 스타일 팔레트 (기획서 '아트 스타일' 3장 / 8장).
 * 저폴리 + 고정 아이소메트릭. 밝고 깨끗한 톤. 검은 그림자를 쓰지 않는다.
 */
export const PAL = {
  sky: '#9FD8E8',
  skyTop: '#BFE8F2',
  ground: '#A8C97F',
  groundDark: '#93B86D',
  road: '#B8B8B0',
  roadDark: '#A3A39B',
  water: '#6FC3DF',
  waterDark: '#54AECC',
  wall: '#F2F2F0',
  roof: '#E85D4A',
  accent: '#FFC845',
  shadow: '#7A9BC4',
} as const;

/** 사업 식별색 */
export const BIZ_COLOR = {
  mine: '#8B6F47',
  factory: '#7E8CA0',
  fishery: '#4A9DB5',
  park: '#E8709A',
  corp: '#5B7FBF',
} as const;

/** 시설 식별색 */
export const FAC_COLOR = {
  housing: '#F2D0A4',
  shops: '#F5A623',
  hospital: '#FFFFFF',
  school: '#A8D5A2',
  fire: '#D9483B',
  police: '#3A5BA0',
  green: '#7FBF6A',
  power: '#C9C9C9',
  road: '#B8B8B0',
} as const;

/** UI 색 (8장) */
export const UI = {
  primary: '#4A90D9',
  buy: '#52B788',
  ad: '#F5A623',
  warn: '#E85D4A',
  disabled: '#C4C4C4',
} as const;

// ── 저폴리 면 명암 ──────────────────────────────────────────
// 같은 색의 밝기만 바꿔 3면을 구분한다 (텍스처 없음, 머티리얼 색만).

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** 명도 조절 (k<1 어둡게, k>1 밝게). 푸른빛을 살짝 섞어 그림자가 검게 죽지 않게 한다. */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const blue = k < 1 ? (1 - k) * 0.35 : 0;
  return rgbToHex(
    r * k + 0x7a * blue,
    g * k + 0x9b * blue,
    b * k + 0xc4 * blue,
  );
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** 아이소 박스 3면 밝기 */
export const FACE = { top: 1.0, right: 0.84, left: 0.66 } as const;
