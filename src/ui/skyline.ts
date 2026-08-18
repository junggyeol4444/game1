import { cityTier } from '../core/progression';
import type { BusinessDef } from '../core/types';

const W = 400;
const H = 180;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SKIES = [
  ['#1b2a4a', '#3d5a86'],
  ['#1a3358', '#4a7fb5'],
  ['#222a52', '#6b5ea8'],
  ['#1a1c3c', '#4b3a72'],
  ['#12142c', '#33265c'],
  ['#0c0f24', '#2a1a4d'],
];

/**
 * 도시 스카이라인. "빈 땅 -> 도시" 가 눈에 보이는 것이 이 게임의 차별점이라
 * 레벨에 따라 건물 수/높이/조명/랜드마크가 확실히 달라지도록 만든다.
 * (광고 소재의 Before/After 도 이 화면을 그대로 쓴다)
 */
export function skylineSVG(level: number, unlocked: BusinessDef[]): string {
  const tier = cityTier(level);
  const [c1, c2] = SKIES[tier];
  const rand = rng(1337);
  const density = Math.min(1, level / 34);
  const count = Math.round(4 + density * 30);
  const night = tier >= 3;

  const parts: string[] = [];
  parts.push(`<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,204,85,0.20)"/><stop offset="100%" stop-color="rgba(255,204,85,0)"/>
    </linearGradient>
  </defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);

  // 별 / 해·달
  if (night) {
    for (let i = 0; i < 40; i++) {
      const x = rand() * W;
      const y = rand() * 90;
      const r = rand() * 1.1 + 0.3;
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.25 + rand() * 0.6).toFixed(2)}"/>`);
    }
    parts.push(`<circle cx="330" cy="38" r="16" fill="#f4f1e0" opacity="0.9"/>`);
    parts.push(`<circle cx="324" cy="34" r="16" fill="${c1}" opacity="0.95"/>`);
  } else {
    parts.push(`<circle cx="332" cy="42" r="20" fill="#ffd98a" opacity="0.85"/>`);
  }

  // 원경 언덕
  parts.push(`<path d="M0 130 Q 60 104 130 124 T 260 118 T 400 128 L400 180 L0 180Z" fill="rgba(8,14,28,0.55)"/>`);

  // 건물
  const buildings: { x: number; w: number; hgt: number }[] = [];
  let x = 6;
  for (let i = 0; i < count; i++) {
    const w = 14 + rand() * 20;
    const maxH = 22 + density * 96;
    const hgt = 16 + rand() * maxH;
    buildings.push({ x, w, hgt });
    x += w + 3 + rand() * 6;
    if (x > W - 12) break;
  }
  const groundY = 150;
  for (const b of buildings) {
    const top = groundY - b.hgt;
    const shade = 12 + Math.floor(rand() * 16);
    parts.push(
      `<rect x="${b.x.toFixed(1)}" y="${top.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.hgt.toFixed(1)}" rx="2" fill="rgb(${shade},${shade + 8},${shade + 22})"/>`,
    );
    // 창문
    const cols = Math.max(1, Math.floor(b.w / 7));
    const rows = Math.max(1, Math.floor(b.hgt / 9));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() > 0.35 + density * 0.35) continue;
        const wx = b.x + 3 + c * 7;
        const wy = top + 4 + r * 9;
        if (wy > groundY - 5) continue;
        parts.push(`<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="3" height="4" fill="${night ? '#ffd97a' : '#cfe4ff'}" opacity="${(0.5 + rand() * 0.5).toFixed(2)}"/>`);
      }
    }
  }

  // 지면 + 도로
  parts.push(`<rect x="0" y="${groundY}" width="${W}" height="${H - groundY}" fill="#0f1728"/>`);
  parts.push(`<rect x="0" y="${groundY}" width="${W}" height="2" fill="#243553"/>`);
  parts.push(`<rect x="0" y="${groundY + 12}" width="${W}" height="6" fill="#16223a"/>`);
  for (let i = 0; i < 16; i++) {
    parts.push(`<rect x="${i * 26 + 6}" y="${groundY + 14.5}" width="12" height="1.5" fill="#3b537f" opacity="0.8"/>`);
  }
  if (night) parts.push(`<rect x="0" y="${groundY - 30}" width="${W}" height="30" fill="url(#glow)"/>`);

  // 해금된 사업 랜드마크
  const slots = [40, 110, 190, 270, 345];
  unlocked.forEach((def, i) => {
    const px = slots[i] ?? 360;
    parts.push(
      `<text x="${px}" y="${groundY + 9}" font-size="20" text-anchor="middle">${def.icon}</text>`,
    );
  });

  if (level <= 2) {
    parts.push(`<text x="${W / 2}" y="60" font-size="12" fill="#a9bfe0" text-anchor="middle" opacity="0.9">여기서 도시를 시작합니다</text>`);
  }

  return `<svg class="skyline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}
