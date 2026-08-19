import type { BusinessId } from '../../core/types';
import {
  clamp01,
  fillRR,
  lerp,
  miner,
  person,
  pingpong,
  seeded,
  sparkle,
  vGradient,
  type Ctx2D,
} from './gfx';

export interface BandArgs {
  ctx: Ctx2D;
  w: number;
  h: number;
  index: number;
  level: number;
  owned: boolean;
  /** 현재 사이클 진행도 0~1 */
  p: number;
  running: boolean;
  auto: boolean;
  boosted: boolean;
  /** 가동률 (자원 부족 시 < 1) */
  eff: number;
  /** 경과 시간(초) */
  t: number;
}

export type BandPainter = (a: BandArgs) => void;

/** 레벨이 오를수록 화면에 사람/설비가 늘어난다 — "성장이 눈에 보이게" */
export function crewCount(level: number): number {
  if (level <= 0) return 0;
  return Math.max(1, Math.min(6, 1 + Math.floor(Math.log10(level) * 2.2)));
}

function lockedOverlay(a: BandArgs): void {
  const { ctx, w, h } = a;
  ctx.fillStyle = 'rgba(6,10,18,0.52)';
  ctx.fillRect(0, 0, w, h);
  // 판자로 막아 둔 부지
  ctx.save();
  ctx.translate(w * 0.5, h * 0.58);
  ctx.fillStyle = 'rgba(122,95,60,0.9)';
  for (const ang of [-0.34, 0.34]) {
    ctx.save();
    ctx.rotate(ang);
    fillRR(ctx, -w * 0.42, -h * 0.055, w * 0.84, h * 0.11, 3, 'rgba(122,95,60,0.92)');
    ctx.strokeStyle = 'rgba(60,45,28,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w * 0.42, -h * 0.055, w * 0.84, h * 0.11);
    ctx.restore();
  }
  ctx.restore();
  // 경고 테이프
  ctx.fillStyle = 'rgba(255,196,61,0.85)';
  ctx.fillRect(0, h - 8, w, 5);
  ctx.fillStyle = 'rgba(30,24,12,0.9)';
  for (let x = -10; x < w; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, h - 8);
    ctx.lineTo(x + 9, h - 8);
    ctx.lineTo(x + 4, h - 3);
    ctx.lineTo(x - 5, h - 3);
    ctx.fill();
  }
}

// ─────────────────────────────── 광산 ───────────────────────────────
const mineBand: BandPainter = (a) => {
  const { ctx, w, h, index, p, t } = a;
  const rand = seeded(index * 7 + 11);
  const shaftW = w * 0.16;
  const ceilY = h * 0.13;
  const floorY = h - h * 0.13;

  // 암반
  ctx.fillStyle = vGradient(ctx, 0, h, '#5a4634', '#2a2018');
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + rand() * 10 - 5, w * 0.6, y - rand() * 10, w, y + rand() * 8 - 4);
    ctx.stroke();
  }

  // 갱도 내부
  ctx.fillStyle = '#2d2117';
  ctx.fillRect(shaftW, ceilY, w - shaftW, floorY - ceilY);

  // 천장 램프 + 빛 웅덩이
  const lampN = Math.max(2, Math.round((w - shaftW) / 78));
  for (let i = 0; i < lampN; i++) {
    const lx = shaftW + ((i + 0.5) * (w - shaftW)) / lampN;
    const flick = 0.82 + 0.18 * Math.sin(t * 3.1 + i * 2.3);
    const g = ctx.createRadialGradient(lx, ceilY + 6, 2, lx, ceilY + 6, h * 0.72);
    g.addColorStop(0, `rgba(255,208,120,${0.5 * flick})`);
    g.addColorStop(0.55, 'rgba(255,180,90,0.09)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(shaftW, ceilY, w - shaftW, floorY - ceilY + 6);
    ctx.strokeStyle = '#7a6244';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, ceilY);
    ctx.lineTo(lx, ceilY + 5);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,222,150,${flick})`;
    ctx.beginPath();
    ctx.arc(lx, ceilY + 7, 3, 0, 7);
    ctx.fill();
  }

  // 갱목(지보공)
  const frameN = Math.max(2, Math.round((w - shaftW) / 92));
  ctx.fillStyle = '#7a5f3c';
  for (let i = 0; i <= frameN; i++) {
    const fx = shaftW + 6 + (i * (w - shaftW - 20)) / frameN;
    ctx.fillRect(fx, ceilY + 2, 5, floorY - ceilY - 2);
    ctx.fillRect(fx - 4, ceilY, 13, 5);
  }

  // 막장 (오른쪽 광맥)
  const faceX = w * 0.70;
  ctx.fillStyle = '#3f3226';
  ctx.beginPath();
  ctx.moveTo(faceX - 6, ceilY);
  for (let y = ceilY; y <= floorY; y += 9) {
    ctx.lineTo(faceX + (rand() * 8 - 2), y);
  }
  ctx.lineTo(w, floorY);
  ctx.lineTo(w, ceilY);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const gy = ceilY + 8 + rand() * (floorY - ceilY - 16);
    const gx = faceX + rand() * 8;
    const col = ['#7fd1c4', '#ffd166', '#c48be0'][i % 3];
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(gx, gy, 4.5, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 바닥 + 레일
  ctx.fillStyle = '#3a2c1f';
  ctx.fillRect(shaftW, floorY, w - shaftW, h - floorY);
  ctx.fillStyle = '#5b4831';
  for (let x = shaftW + 6; x < w; x += 13) ctx.fillRect(x, floorY + 2, 6, 4);
  ctx.strokeStyle = '#8e7c5e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(shaftW, floorY + 3);
  ctx.lineTo(w, floorY + 3);
  ctx.moveTo(shaftW, floorY + 8);
  ctx.lineTo(w, floorY + 8);
  ctx.stroke();

  // 수직 갱 + 케이지
  ctx.fillStyle = '#150f0a';
  ctx.fillRect(0, 0, shaftW, h);
  ctx.fillStyle = '#6b5233';
  ctx.fillRect(shaftW - 4, 0, 4, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let y = 4; y < h; y += 11) {
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(shaftW - 5, y);
    ctx.stroke();
  }
  const cageY = lerp(h * 0.08, h * 0.6, pingpong(t * 0.22 + index * 0.13));
  fillRR(ctx, shaftW * 0.16, cageY, shaftW * 0.68, h * 0.32, 3, '#8a7048');
  ctx.strokeStyle = '#c0a473';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(shaftW * 0.16, cageY, shaftW * 0.68, h * 0.32);
  ctx.strokeStyle = '#c0a473';
  ctx.beginPath();
  ctx.moveTo(shaftW * 0.5, 0);
  ctx.lineTo(shaftW * 0.5, cageY);
  ctx.stroke();

  // 광차
  const cartX = shaftW + 10;
  const cartW = w * 0.13;
  const cartH = h * 0.24;
  const cartY = floorY - cartH;
  fillRR(ctx, cartX, cartY, cartW, cartH, 3, '#6b5233');
  ctx.strokeStyle = '#3a2c1c';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(cartX, cartY, cartW, cartH);
  const fill = clamp01(p) * (cartH - 5);
  ctx.fillStyle = '#8ad6c8';
  ctx.fillRect(cartX + 3, cartY + cartH - 3 - fill, cartW - 6, fill);
  ctx.fillStyle = '#1d160f';
  ctx.beginPath();
  ctx.arc(cartX + cartW * 0.25, cartY + cartH + 3, 3, 0, 7);
  ctx.arc(cartX + cartW * 0.75, cartY + cartH + 3, 3, 0, 7);
  ctx.fill();

  if (!a.owned) return lockedOverlay(a);

  // 광부
  const crew = crewCount(a.level);
  const startX = cartX + cartW + 10;
  const ph = h * 0.42;
  for (let k = 0; k < crew; k++) {
    const q = (p + k / crew) % 1;
    let x: number;
    let opts: Parameters<typeof miner>[4];
    let facing: 1 | -1 = 1;
    if (q < 0.35) {
      x = lerp(startX, faceX - 16, q / 0.35);
      opts = { phase: q * 6, facing: 1 };
    } else if (q < 0.65) {
      x = faceX - 16;
      const wk = (q - 0.35) / 0.3;
      opts = { work: wk * 3, facing: 1 };
      if (Math.sin(wk * 3 * Math.PI * 2) > 0.85) {
        sparkle(ctx, faceX - 4, floorY - ph * 0.55, 6, '#ffe08a', 0.95);
      }
    } else {
      facing = -1;
      x = lerp(faceX - 16, startX, (q - 0.65) / 0.35);
      opts = { phase: q * 6, facing: -1, carry: '#8ad6c8' };
    }
    // 헤드램프 빛
    const lg = ctx.createRadialGradient(x + facing * 8, floorY - ph * 0.82, 1, x + facing * 8, floorY - ph * 0.82, 34);
    lg.addColorStop(0, 'rgba(255,231,163,0.35)');
    lg.addColorStop(1, 'rgba(255,231,163,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(x + facing * 8, floorY - ph * 0.82, 34, 0, 7);
    ctx.fill();
    miner(ctx, x, floorY + 3, ph, opts);
  }
};

// ─────────────────────────────── 공장 ───────────────────────────────
const factoryBand: BandPainter = (a) => {
  const { ctx, w, h, index, p, t } = a;
  const floorY = h - h * 0.14;
  const beltY = floorY - h * 0.18;

  ctx.fillStyle = vGradient(ctx, 0, h, '#2f4166', '#1a2438');
  ctx.fillRect(0, 0, w, h);
  // 뒷벽 창문
  const rand = seeded(index * 13 + 3);
  for (let i = 0; i < 5; i++) {
    const x = 10 + i * (w / 5);
    ctx.fillStyle = i % 2 ? 'rgba(126,224,255,0.10)' : 'rgba(126,224,255,0.06)';
    fillRR(ctx, x, h * 0.1, w / 7, h * 0.28, 3, ctx.fillStyle as string);
  }
  // 배관
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.08);
  ctx.lineTo(w * 0.7, h * 0.08);
  ctx.lineTo(w * 0.7, h * 0.2);
  ctx.stroke();

  // 바닥
  ctx.fillStyle = '#101827';
  ctx.fillRect(0, floorY, w, h - floorY);

  // 성형기 (왼쪽)
  const mW = w * 0.2;
  fillRR(ctx, 6, beltY - h * 0.34, mW, h * 0.34 + h * 0.18, 4, '#485c86');
  fillRR(ctx, 10, beltY - h * 0.3, mW - 8, h * 0.16, 3, '#20293f');
  // 피스톤
  const piston = pingpong(p * 2) * (h * 0.1);
  ctx.fillStyle = '#7ee0ff';
  ctx.fillRect(6 + mW * 0.3, beltY - h * 0.3 + piston, mW * 0.4, h * 0.08);
  if (p % 0.5 < 0.08) sparkle(ctx, 6 + mW * 0.5, beltY - h * 0.22, 5, '#ffe08a', 0.8);

  // 컨베이어
  const bx0 = 6 + mW;
  const bx1 = w * 0.63;
  fillRR(ctx, bx0, beltY, bx1 - bx0, h * 0.09, 3, '#37486d');
  ctx.fillStyle = '#6b81b3';
  const off = (t * 40) % 14;
  for (let x = bx0 + 4 - off; x < bx1 - 2; x += 14) {
    if (x < bx0) continue;
    ctx.fillRect(x, beltY + h * 0.03, 6, h * 0.03);
  }

  if (!a.owned) return lockedOverlay(a);

  // 제품 상자들
  const crew = crewCount(a.level);
  const boxN = Math.min(5, crew + 1);
  for (let k = 0; k < boxN; k++) {
    const q = (p + k / boxN) % 1;
    const x = lerp(bx0 + 4, bx1 - 16, q);
    const s = h * 0.16;
    fillRR(ctx, x, beltY - s, s * 1.1, s, 2, '#e9a23b');
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, beltY - s * 0.5);
    ctx.lineTo(x + s * 1.1, beltY - s * 0.5);
    ctx.stroke();
  }

  // 적재 트럭
  const tx = bx1 + 4;
  const tW = w * 0.2;
  fillRR(ctx, tx, floorY - h * 0.3, tW, h * 0.3, 3, '#5b8def');
  fillRR(ctx, tx + 2, floorY - h * 0.26, tW * 0.42, h * 0.16, 2, '#0f1728');
  ctx.fillStyle = '#0b111c';
  ctx.beginPath();
  ctx.arc(tx + tW * 0.28, floorY, 3.5, 0, 7);
  ctx.arc(tx + tW * 0.76, floorY, 3.5, 0, 7);
  ctx.fill();

  // 작업자
  person(ctx, 6 + mW + 14, floorY, h * 0.3, { phase: t * 0.6, body: '#5b8def', facing: 1 });
  if (crew > 2) person(ctx, bx1 - 18, floorY, h * 0.3, { phase: t * 0.5 + 0.3, body: '#7ee0ff', facing: -1 });
  if (crew > 4) person(ctx, (bx0 + bx1) / 2, floorY, h * 0.28, { phase: t * 0.7, body: '#9db4e8', facing: 1 });
  void rand;
};

// ─────────────────────────────── 어항 ───────────────────────────────
const fisheryBand: BandPainter = (a) => {
  const { ctx, w, h, index, p, t } = a;
  const seaY = h * 0.42;

  ctx.fillStyle = vGradient(ctx, 0, seaY, '#274b7a', '#3a6f9e');
  ctx.fillRect(0, 0, w, seaY);
  ctx.fillStyle = vGradient(ctx, seaY, h, '#12496b', '#07253a');
  ctx.fillRect(0, seaY, w, h - seaY);

  // 파도
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    const yy = seaY + 5 + r * 9;
    for (let x = 0; x <= w; x += 6) {
      const y = yy + Math.sin((x / 26) + t * (1.2 + r * 0.3) + index) * 2;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 부두
  const dockW = w * 0.2;
  ctx.fillStyle = '#4a3a2b';
  ctx.fillRect(0, seaY - h * 0.1, dockW, h * 0.1);
  ctx.fillStyle = '#33271d';
  ctx.fillRect(dockW - 5, seaY, 4, h * 0.3);
  ctx.fillRect(dockW * 0.4, seaY, 4, h * 0.3);
  // 창고
  fillRR(ctx, 4, seaY - h * 0.34, dockW * 0.7, h * 0.24, 3, '#7a6a55');
  ctx.fillStyle = '#3d3327';
  ctx.beginPath();
  ctx.moveTo(2, seaY - h * 0.34);
  ctx.lineTo(4 + dockW * 0.35, seaY - h * 0.46);
  ctx.lineTo(6 + dockW * 0.7, seaY - h * 0.34);
  ctx.fill();

  if (!a.owned) return lockedOverlay(a);

  // 배 (나갔다 돌아옴)
  const out = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
  const bx = lerp(dockW + 6, w * 0.58, out);
  const bob = Math.sin(t * 2.4 + index) * 2;
  const by = seaY - 2 + bob;
  const boatW = w * 0.16;
  ctx.fillStyle = '#e2e8f4';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + boatW, by);
  ctx.lineTo(bx + boatW * 0.82, by + h * 0.11);
  ctx.lineTo(bx + boatW * 0.12, by + h * 0.11);
  ctx.closePath();
  ctx.fill();
  fillRR(ctx, bx + boatW * 0.5, by - h * 0.14, boatW * 0.32, h * 0.14, 2, '#5b8def');
  ctx.strokeStyle = '#cbd6ea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx + boatW * 0.2, by);
  ctx.lineTo(bx + boatW * 0.2, by - h * 0.26);
  ctx.stroke();
  person(ctx, bx + boatW * 0.3, by, h * 0.22, { body: '#22a2a2', phase: 0, facing: p < 0.5 ? 1 : -1 });

  // 그물 투척 구간
  if (p > 0.35 && p < 0.68) {
    const q = (p - 0.35) / 0.33;
    const netY = by + h * 0.1 + q * h * 0.3;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + boatW * 0.5, by + h * 0.1);
      ctx.lineTo(bx + boatW * 0.5 + i * 7, netY);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(bx + boatW * 0.5, netY, 22, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 물고기
  const crew = crewCount(a.level);
  const rand = seeded(index * 5 + 2);
  for (let k = 0; k < crew + 2; k++) {
    const base = rand();
    const fx = ((t * (12 + base * 20) + base * w) % (w + 40)) - 20;
    const fy = seaY + h * 0.22 + base * (h * 0.3);
    ctx.fillStyle = ['#ffd166', '#7ee0ff', '#f4978e'][k % 3];
    ctx.beginPath();
    ctx.ellipse(fx, fy, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx + 5, fy);
    ctx.lineTo(fx + 9, fy - 2.5);
    ctx.lineTo(fx + 9, fy + 2.5);
    ctx.fill();
  }

  // 하역 (사이클 끝)
  if (p > 0.9) {
    for (let k = 0; k < 3; k++) {
      fillRR(ctx, 8 + k * 12, seaY - h * 0.2 - (p - 0.9) * 30, 10, 8, 2, '#22a2a2');
    }
  }
};

// ────────────────────────────── 놀이공원 ──────────────────────────────
const parkBand: BandPainter = (a) => {
  const { ctx, w, h, index, p, t } = a;
  const groundY = h - h * 0.2;

  ctx.fillStyle = vGradient(ctx, 0, groundY, '#3b2a5c', '#6d4a86');
  ctx.fillRect(0, 0, w, groundY);
  ctx.fillStyle = '#2b7a52';
  ctx.fillRect(0, groundY, w, h - groundY);
  // 산책로
  ctx.fillStyle = '#c9b391';
  ctx.fillRect(0, groundY + (h - groundY) * 0.42, w, (h - groundY) * 0.42);

  const cx = w * 0.44;
  const spin = a.owned ? t * (a.boosted ? 2.4 : 1.1) + p * 2 : t * 0.05;

  const drawFerris = () => {
    const r = h * 0.3;
    const cy = groundY - r - h * 0.06;
    ctx.strokeStyle = '#cbd6ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, groundY);
    ctx.lineTo(cx, cy);
    ctx.moveTo(cx + r * 0.5, groundY);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const ang = spin + (i / 8) * Math.PI * 2;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
      fillRR(ctx, x - 4, y, 8, 6, 2, ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0'][i % 4]);
    }
  };

  const drawCarousel = () => {
    const r = h * 0.26;
    const cy = groundY - h * 0.1;
    ctx.fillStyle = '#f4978e';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.5);
    ctx.lineTo(cx, cy - r * 1.25);
    ctx.lineTo(cx + r, cy - r * 0.5);
    ctx.fill();
    ctx.fillStyle = '#e9e4f0';
    ctx.fillRect(cx - r * 0.9, cy - r * 0.5, r * 1.8, r * 0.14);
    for (let i = 0; i < 5; i++) {
      const ang = spin + (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(ang) * r * 0.75;
      const sc = 0.75 + Math.sin(ang) * 0.25;
      ctx.strokeStyle = '#cbd6ea';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, cy - r * 0.4);
      ctx.lineTo(x, cy - r * 0.05 * sc);
      ctx.stroke();
      fillRR(ctx, x - 4 * sc, cy - r * 0.1 - 8 * sc, 8 * sc, 8 * sc, 2, i % 2 ? '#ffd166' : '#7ee0ff');
    }
  };

  const drawCoaster = () => {
    ctx.strokeStyle = '#cbd6ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const y0 = groundY - h * 0.08;
    for (let x = w * 0.3; x <= w * 0.95; x += 4) {
      const q = (x - w * 0.3) / (w * 0.65);
      const y = y0 - Math.sin(q * Math.PI * 2) * h * 0.24 - h * 0.05;
      x === w * 0.3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const q = (spin * 0.12) % 1;
    const carX = lerp(w * 0.3, w * 0.95, q);
    const carY = y0 - Math.sin(q * Math.PI * 2) * h * 0.24 - h * 0.05;
    fillRR(ctx, carX - 7, carY - 8, 14, 8, 2, '#f4978e');
  };

  const drawGhost = () => {
    fillRR(ctx, cx - w * 0.1, groundY - h * 0.4, w * 0.2, h * 0.4, 3, '#3a2b4a');
    ctx.fillStyle = '#241a30';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.11, groundY - h * 0.4);
    ctx.lineTo(cx, groundY - h * 0.56);
    ctx.lineTo(cx + w * 0.11, groundY - h * 0.4);
    ctx.fill();
    const open = pingpong(p * 2);
    ctx.fillStyle = '#0d0714';
    ctx.fillRect(cx - w * 0.035, groundY - h * 0.22, w * 0.07, h * 0.22);
    ctx.globalAlpha = open;
    ctx.fillStyle = '#b8f2a0';
    ctx.beginPath();
    ctx.arc(cx, groundY - h * 0.16 - open * h * 0.08, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - w * 0.08, groundY - h * 0.34, 6, 6);
    ctx.fillRect(cx + w * 0.06, groundY - h * 0.34, 6, 6);
  };

  const drawBumper = () => {
    fillRR(ctx, cx - w * 0.14, groundY - h * 0.3, w * 0.3, h * 0.3, 4, '#2b3855');
    for (let i = 0; i < 4; i++) {
      const ang = spin * 1.6 + (i / 4) * Math.PI * 2;
      const x = cx + Math.cos(ang) * w * 0.09;
      const y = groundY - h * 0.15 + Math.sin(ang) * h * 0.08;
      fillRR(ctx, x - 6, y - 4, 12, 8, 3, ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0'][i]);
    }
  };

  const drawWater = () => {
    ctx.fillStyle = '#7ee0ff';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.14, groundY);
    ctx.quadraticCurveTo(cx - w * 0.02, groundY - h * 0.42, cx + w * 0.14, groundY - h * 0.44);
    ctx.lineTo(cx + w * 0.14, groundY - h * 0.36);
    ctx.quadraticCurveTo(cx - w * 0.01, groundY - h * 0.34, cx - w * 0.08, groundY);
    ctx.fill();
    const q = (spin * 0.2) % 1;
    const rx = lerp(cx + w * 0.13, cx - w * 0.1, q);
    const ry = lerp(groundY - h * 0.4, groundY - h * 0.02, q * q);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(rx, ry, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(126,224,255,0.8)';
    ctx.fillRect(cx - w * 0.16, groundY - h * 0.06, w * 0.12, h * 0.06);
  };

  [drawCarousel, drawBumper, drawFerris, drawGhost, drawCoaster, drawWater][index % 6]();

  if (!a.owned) return lockedOverlay(a);

  // 관람객
  const crew = crewCount(a.level) + 1;
  const rand = seeded(index * 17 + 5);
  for (let k = 0; k < crew; k++) {
    const base = rand();
    const dir = base > 0.5 ? 1 : -1;
    const speed = 10 + base * 14;
    const x = dir > 0
      ? ((t * speed + base * w) % (w + 30)) - 15
      : w + 15 - ((t * speed + base * w) % (w + 30));
    person(ctx, x, groundY + (h - groundY) * 0.84, h * 0.26, {
      phase: t * 1.6 + base * 3,
      facing: dir as 1 | -1,
      body: ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0', '#d6a8f5'][k % 5],
    });
  }
};

// ─────────────────────────────── 기업 ───────────────────────────────
const corpBand: BandPainter = (a) => {
  const { ctx, w, h, index, p, t } = a;
  const floorY = h - h * 0.12;

  ctx.fillStyle = vGradient(ctx, 0, h, '#1d2440', '#12172a');
  ctx.fillRect(0, 0, w, h);
  // 창밖 야경
  const rand = seeded(index * 23 + 7);
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(w * 0.02, h * 0.08, w * 0.96, h * 0.36);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = rand() > 0.4 ? 'rgba(255,217,122,0.75)' : 'rgba(126,224,255,0.35)';
    ctx.fillRect(w * 0.04 + rand() * w * 0.9, h * 0.1 + rand() * h * 0.3, 2.5, 3);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo((w * i) / 5, h * 0.08);
    ctx.lineTo((w * i) / 5, h * 0.44);
    ctx.stroke();
  }

  // 바닥
  ctx.fillStyle = '#0e1424';
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = 'rgba(91,141,239,0.10)';
  ctx.fillRect(0, h * 0.44, w, floorY - h * 0.44);

  if (!a.owned) return lockedOverlay(a);

  // 책상 + 직원
  const crew = crewCount(a.level);
  const deskN = Math.min(4, Math.max(2, crew));
  for (let k = 0; k < deskN; k++) {
    const x = w * 0.06 + k * ((w * 0.54) / deskN);
    fillRR(ctx, x, floorY - h * 0.16, w * 0.13, h * 0.06, 2, '#8b6df0');
    ctx.fillStyle = '#2b3855';
    ctx.fillRect(x + w * 0.01, floorY - h * 0.1, 3, h * 0.1);
    ctx.fillRect(x + w * 0.11, floorY - h * 0.1, 3, h * 0.1);
    // 모니터
    fillRR(ctx, x + w * 0.045, floorY - h * 0.3, w * 0.045, h * 0.1, 2, '#101827');
    ctx.fillStyle = Math.sin(t * 3 + k) > 0 ? 'rgba(126,224,255,0.8)' : 'rgba(126,224,255,0.45)';
    ctx.fillRect(x + w * 0.05, floorY - h * 0.285, w * 0.035, h * 0.07);
    person(ctx, x + w * 0.02, floorY - h * 0.02, h * 0.26, {
      phase: 0,
      facing: 1,
      body: ['#8b6df0', '#5b8def', '#22a2a2', '#e0629b'][k % 4],
    });
  }

  // 계약서가 금고로 이동
  const docX = lerp(w * 0.08, w * 0.60, p);
  const docY = floorY - h * 0.42 - Math.sin(p * Math.PI) * h * 0.1;
  ctx.fillStyle = '#f5f2ea';
  fillRR(ctx, docX, docY, 10, 13, 2, '#f5f2ea');
  ctx.strokeStyle = '#9aa6bd';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(docX + 2, docY + 3 + i * 3);
    ctx.lineTo(docX + 8, docY + 3 + i * 3);
    ctx.stroke();
  }

  // 금고
  fillRR(ctx, w * 0.62, floorY - h * 0.34, w * 0.12, h * 0.34, 3, '#3a4a6b');
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * 0.68, floorY - h * 0.17, h * 0.07, 0, Math.PI * 2);
  ctx.stroke();
  if (p > 0.95) sparkle(ctx, w * 0.68, floorY - h * 0.17, 9, '#ffd166', 1);
};

export const BAND_PAINTERS: Record<BusinessId, BandPainter> = {
  mine: mineBand,
  factory: factoryBand,
  fishery: fisheryBand,
  park: parkBand,
  corp: corpBand,
};
