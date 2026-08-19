import type { BuildingId } from '../../data/buildings';
import { fillRR, lerp, person, seeded, vGradient, type Ctx2D } from './gfx';

export interface TownArgs {
  ctx: Ctx2D;
  /** 건물 바닥 중심 */
  x: number;
  baseY: number;
  /** 부지 폭 */
  w: number;
  /** 외형 단계 0(빈 터) ~ 4 */
  tier: number;
  t: number;
  night: boolean;
  /** ⚠️ 병목/사고 */
  alert: boolean;
}

type Painter = (a: TownArgs) => void;

const lit = (a: TownArgs, on: boolean) =>
  on ? (a.night ? 'rgba(255,217,122,0.95)' : 'rgba(210,235,255,0.75)') : 'rgba(120,150,200,0.18)';

function windows(a: TownArgs, x: number, y: number, w: number, h: number, cols: number, rows: number, seed: number): void {
  const { ctx, t } = a;
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = (Math.sin(t * 0.5 + seed + r * 2.1 + c * 1.3) + 1) / 2 > (a.night ? 0.3 : 0.7);
      ctx.fillStyle = lit(a, on);
      ctx.fillRect(x + c * cw + cw * 0.22, y + r * ch + ch * 0.22, cw * 0.56, ch * 0.5);
    }
  }
}

/** 빈 부지 */
function emptyLot(a: TownArgs): void {
  const { ctx, x, baseY, w } = a;
  ctx.fillStyle = '#4b3f30';
  ctx.beginPath();
  ctx.ellipse(x, baseY, w * 0.42, w * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,61,0.55)';
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, baseY, w * 0.42, w * 0.07, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ───────────────────────────── 사업 건물 ─────────────────────────────

const mine: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  const th = w * (0.42 + tier * 0.1);
  // 부지
  ctx.fillStyle = '#4a3a2b';
  ctx.fillRect(x - w / 2, baseY - w * 0.06, w, w * 0.06);
  // 창고
  const sheds = tier;
  for (let i = 0; i < sheds; i++) {
    const sw = w * 0.2;
    const sx = x - w * 0.46 + i * (sw + 3);
    fillRR(ctx, sx, baseY - w * 0.16, sw, w * 0.16, 2, '#6b5233');
    ctx.fillStyle = '#3a2c1c';
    ctx.beginPath();
    ctx.moveTo(sx - 2, baseY - w * 0.16);
    ctx.lineTo(sx + sw / 2, baseY - w * 0.22);
    ctx.lineTo(sx + sw + 2, baseY - w * 0.16);
    ctx.fill();
  }
  // 권양탑
  const tx = x + w * 0.22;
  ctx.strokeStyle = '#b39a70';
  ctx.lineWidth = Math.max(2, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(tx - w * 0.12, baseY);
  ctx.lineTo(tx, baseY - th);
  ctx.lineTo(tx + w * 0.12, baseY);
  ctx.moveTo(tx - w * 0.08, baseY - th * 0.45);
  ctx.lineTo(tx + w * 0.08, baseY - th * 0.45);
  ctx.stroke();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = Math.max(1.8, w * 0.015);
  const r = w * 0.06;
  ctx.beginPath();
  ctx.arc(tx, baseY - th, r, 0, 7);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const ang = t * 2 + (i / 3) * Math.PI * 2;
    ctx.moveTo(tx, baseY - th);
    ctx.lineTo(tx + Math.cos(ang) * r, baseY - th + Math.sin(ang) * r);
  }
  ctx.stroke();
  // 광석 더미
  if (tier >= 2) {
    ctx.fillStyle = '#4e6b66';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, baseY);
    ctx.lineTo(x + w * 0.02, baseY - w * (0.06 + tier * 0.02));
    ctx.lineTo(x + w * 0.14, baseY);
    ctx.fill();
  }
};

const factory: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  const bw = w * (0.5 + tier * 0.09);
  const bh = w * (0.2 + tier * 0.05);
  const bx = x - bw / 2;
  fillRR(ctx, bx, baseY - bh, bw, bh, 2, '#33456b');
  ctx.fillStyle = '#243450';
  const teeth = 2 + tier;
  for (let i = 0; i < teeth; i++) {
    ctx.beginPath();
    ctx.moveTo(bx + (i * bw) / teeth, baseY - bh);
    ctx.lineTo(bx + (i * bw) / teeth + bw / (teeth * 2), baseY - bh - w * 0.07);
    ctx.lineTo(bx + ((i + 1) * bw) / teeth, baseY - bh);
    ctx.fill();
  }
  windows(a, bx + 4, baseY - bh * 0.7, bw - 8, bh * 0.45, 3 + tier, 1, 11);
  // 굴뚝 + 연기
  for (let c = 0; c < Math.max(1, tier - 1); c++) {
    const chx = bx + bw + 4 + c * w * 0.11;
    const chh = w * (0.28 + tier * 0.05);
    fillRR(ctx, chx, baseY - chh, w * 0.055, chh, 1, '#3d4f75');
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.3 + i * 0.25 + c * 0.1) % 1;
      ctx.globalAlpha = (1 - q) * 0.34;
      ctx.fillStyle = '#cfd9ea';
      ctx.beginPath();
      ctx.arc(chx + w * 0.027 + Math.sin(q * 4 + i) * w * 0.03, baseY - chh - q * w * 0.3, w * (0.02 + q * 0.05), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
};

const fishery: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  // 물
  ctx.fillStyle = '#0f3a56';
  ctx.fillRect(x - w * 0.5, baseY - w * 0.04, w, w * 0.16);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.4;
  for (let r = 0; r < 2; r++) {
    ctx.beginPath();
    for (let px = x - w * 0.5; px <= x + w * 0.5; px += 6) {
      const y = baseY + 4 + r * 7 + Math.sin(px / 14 + t * 1.6) * 1.8;
      px === x - w * 0.5 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  // 창고
  fillRR(ctx, x - w * 0.46, baseY - w * 0.22, w * 0.3, w * 0.2, 2, '#7a6a55');
  ctx.fillStyle = '#3d3327';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.48, baseY - w * 0.22);
  ctx.lineTo(x - w * 0.31, baseY - w * 0.3);
  ctx.lineTo(x - w * 0.14, baseY - w * 0.22);
  ctx.fill();
  // 배
  const boats = tier;
  for (let i = 0; i < boats; i++) {
    const bx = x - w * 0.06 + i * w * 0.16;
    const by = baseY + 2 + Math.sin(t * 2 + i) * 2;
    const bw2 = w * 0.13;
    ctx.fillStyle = '#e2e8f4';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + bw2, by);
    ctx.lineTo(bx + bw2 * 0.82, by + w * 0.05);
    ctx.lineTo(bx + bw2 * 0.14, by + w * 0.05);
    ctx.fill();
    ctx.strokeStyle = '#cbd6ea';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx + bw2 * 0.25, by);
    ctx.lineTo(bx + bw2 * 0.25, by - w * (0.1 + tier * 0.02));
    ctx.stroke();
  }
};

const park: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ctx.fillStyle = '#2b7a52';
  ctx.fillRect(x - w / 2, baseY - w * 0.04, w, w * 0.04);
  // 대관람차
  const r = w * (0.11 + tier * 0.035);
  const cx = x + w * 0.2;
  const cy = baseY - r - w * 0.06;
  ctx.strokeStyle = '#cbd6ea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, baseY);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + r * 0.5, baseY);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,209,102,0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 7);
  ctx.stroke();
  const spin = t * 0.8;
  for (let i = 0; i < 8; i++) {
    const ang = spin + (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.stroke();
    fillRR(ctx, cx + Math.cos(ang) * r - 3, cy + Math.sin(ang) * r, 6, 5, 2, ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0'][i % 4]);
  }
  // 텐트 / 게이트
  ctx.fillStyle = '#e0629b';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.42, baseY);
  ctx.lineTo(x - w * 0.28, baseY - w * (0.14 + tier * 0.02));
  ctx.lineTo(x - w * 0.14, baseY);
  ctx.fill();
  if (tier >= 3) {
    ctx.fillStyle = '#7ee0ff';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, baseY);
    ctx.quadraticCurveTo(x - w * 0.02, baseY - w * 0.22, x + w * 0.04, baseY - w * 0.24);
    ctx.lineTo(x + w * 0.04, baseY - w * 0.2);
    ctx.quadraticCurveTo(x - w * 0.01, baseY - w * 0.18, x - w * 0.05, baseY);
    ctx.fill();
  }
};

const corp: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  const bw = w * (0.42 + tier * 0.03);
  const bh = w * (0.35 + tier * 0.28);
  const bx = x - bw / 2;
  ctx.fillStyle = '#2a3556';
  ctx.fillRect(bx, baseY - bh, bw, bh);
  ctx.fillStyle = '#8b6df0';
  ctx.fillRect(bx, baseY - bh, bw, Math.max(2, w * 0.02));
  windows(a, bx + 3, baseY - bh + w * 0.04, bw - 6, bh - w * 0.06, 3, Math.max(3, 2 + tier * 2), 23);
  if (tier >= 3) {
    ctx.fillStyle = Math.sin(t * 3) > 0 ? '#f87171' : 'rgba(248,113,113,0.2)';
    ctx.beginPath();
    ctx.arc(x, baseY - bh - w * 0.02, Math.max(2, w * 0.016), 0, 7);
    ctx.fill();
  }
};

// ───────────────────────────── 시설 건물 ─────────────────────────────

const housing: Painter = (a) => {
  const { ctx, x, baseY, w, tier } = a;
  if (tier === 0) return emptyLot(a);
  const blocks = Math.min(4, tier);
  const bw = (w * 0.94) / blocks;
  for (let i = 0; i < blocks; i++) {
    const bh = w * (0.2 + tier * 0.12) * (0.8 + ((i * 7) % 5) * 0.06);
    const bx = x - w * 0.47 + i * bw;
    ctx.fillStyle = '#8a7a5e';
    ctx.fillRect(bx + 2, baseY - bh, bw - 4, bh);
    if (tier <= 1) {
      ctx.fillStyle = '#a4553f';
      ctx.beginPath();
      ctx.moveTo(bx, baseY - bh);
      ctx.lineTo(bx + bw / 2, baseY - bh - w * 0.08);
      ctx.lineTo(bx + bw, baseY - bh);
      ctx.fill();
    } else {
      ctx.fillStyle = '#5c5344';
      ctx.fillRect(bx, baseY - bh - w * 0.02, bw, w * 0.02);
    }
    windows(a, bx + 4, baseY - bh + w * 0.03, bw - 8, bh - w * 0.05, 2, Math.max(2, tier * 2), 31 + i);
  }
};

const shops: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  const bw = w * 0.92;
  const bh = w * (0.16 + tier * 0.07);
  const bx = x - bw / 2;
  fillRR(ctx, bx, baseY - bh, bw, bh, 2, '#5d4a63');
  // 차양
  const stalls = 2 + tier;
  for (let i = 0; i < stalls; i++) {
    const sw = bw / stalls;
    const sx = bx + i * sw;
    ctx.fillStyle = i % 2 ? '#f4978e' : '#ffd166';
    ctx.fillRect(sx + 2, baseY - bh * 0.45, sw - 4, w * 0.03);
    ctx.fillStyle = lit(a, (Math.sin(t * 2 + i) + 1) / 2 > 0.35);
    ctx.fillRect(sx + sw * 0.2, baseY - bh * 0.34, sw * 0.6, w * 0.035);
  }
  // 간판
  if (tier >= 2) {
    ctx.fillStyle = a.night ? 'rgba(255,120,200,0.9)' : 'rgba(255,120,200,0.5)';
    ctx.fillRect(bx + bw * 0.3, baseY - bh - w * 0.09, bw * 0.4, w * 0.07);
  }
};

const hospital: Painter = (a) => {
  const { ctx, x, baseY, w, tier } = a;
  if (tier === 0) return emptyLot(a);
  const bw = w * (0.66 + tier * 0.06);
  const bh = w * (0.24 + tier * 0.09);
  const bx = x - bw / 2;
  ctx.fillStyle = '#e8eef8';
  ctx.fillRect(bx, baseY - bh, bw, bh);
  windows(a, bx + 3, baseY - bh + w * 0.03, bw - 6, bh - w * 0.05, 3, Math.max(2, tier), 41);
  // 십자
  ctx.fillStyle = '#e63946';
  const cs = w * 0.055;
  ctx.fillRect(x - cs / 6, baseY - bh - cs * 0.1, cs / 3, cs);
  ctx.fillRect(x - cs / 2, baseY - bh + cs * 0.23, cs, cs / 3);
  if (tier >= 3) {
    ctx.strokeStyle = '#9aa6bd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + bw * 0.3, baseY - bh - w * 0.03, w * 0.05, 0, 7);
    ctx.stroke();
  }
};

const school: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  const wings = Math.min(3, tier);
  const bw = (w * 0.92) / wings;
  for (let i = 0; i < wings; i++) {
    const bh = w * (0.2 + tier * 0.05);
    const bx = x - w * 0.46 + i * bw;
    ctx.fillStyle = '#c8a06a';
    ctx.fillRect(bx + 2, baseY - bh, bw - 4, bh);
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(bx, baseY - bh - w * 0.02, bw, w * 0.02);
    windows(a, bx + 4, baseY - bh + w * 0.03, bw - 8, bh - w * 0.05, 3, 2, 51 + i);
  }
  // 시계탑 / 깃대
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(x - w * 0.02, baseY - w * (0.34 + tier * 0.05), w * 0.04, w * (0.14 + tier * 0.05));
  ctx.fillStyle = '#f5f2ea';
  ctx.beginPath();
  ctx.arc(x, baseY - w * (0.34 + tier * 0.05), w * 0.035, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#2b3a55';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, baseY - w * (0.34 + tier * 0.05));
  ctx.lineTo(x + Math.cos(t * 0.4) * w * 0.024, baseY - w * (0.34 + tier * 0.05) + Math.sin(t * 0.4) * w * 0.024);
  ctx.stroke();
};

const fire: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t, alert } = a;
  if (tier === 0) return emptyLot(a);
  const bw = w * (0.7 + tier * 0.05);
  const bh = w * (0.24 + tier * 0.05);
  const bx = x - bw / 2;
  fillRR(ctx, bx, baseY - bh, bw, bh, 2, '#a83a2a');
  const bays = Math.min(3, tier);
  for (let i = 0; i < bays; i++) {
    const gw = bw / (bays + 0.6);
    ctx.fillStyle = '#2b1a16';
    ctx.fillRect(bx + 6 + i * gw, baseY - bh * 0.72, gw - 8, bh * 0.72);
  }
  // 사이렌
  if (alert) {
    ctx.fillStyle = Math.sin(t * 12) > 0 ? '#ff5a4a' : 'rgba(255,90,74,0.25)';
    ctx.beginPath();
    ctx.arc(x, baseY - bh - w * 0.03, w * 0.03, 0, 7);
    ctx.fill();
  }
};

const police: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  const bw = w * (0.7 + tier * 0.05);
  const bh = w * (0.24 + tier * 0.07);
  const bx = x - bw / 2;
  fillRR(ctx, bx, baseY - bh, bw, bh, 2, '#3a5288');
  windows(a, bx + 4, baseY - bh + w * 0.03, bw - 8, bh - w * 0.06, 3, Math.max(1, tier - 1), 61);
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#5b8def' : '#e63946';
  ctx.beginPath();
  ctx.arc(x, baseY - bh - w * 0.025, w * 0.024, 0, 7);
  ctx.fill();
};

const green: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ctx.fillStyle = '#2f8a56';
  ctx.beginPath();
  ctx.ellipse(x, baseY, w * 0.48, w * 0.08, 0, 0, 7);
  ctx.fill();
  const trees = 2 + tier * 2;
  const rand = seeded(71);
  for (let i = 0; i < trees; i++) {
    const tx = x - w * 0.44 + rand() * w * 0.88;
    const th = w * (0.1 + rand() * 0.06 + tier * 0.015);
    ctx.fillStyle = '#5a3d24';
    ctx.fillRect(tx - 1.5, baseY - th, 3, th);
    ctx.fillStyle = '#3aa06a';
    ctx.beginPath();
    ctx.arc(tx, baseY - th - w * 0.03, w * 0.05, 0, 7);
    ctx.fill();
  }
  // 분수
  if (tier >= 2) {
    ctx.fillStyle = '#6aa9d8';
    ctx.beginPath();
    ctx.ellipse(x, baseY - w * 0.02, w * 0.1, w * 0.035, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,230,255,0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.3;
      const hgt = w * (0.06 + Math.abs(Math.sin(t * 2 + i)) * 0.03);
      ctx.beginPath();
      ctx.moveTo(x, baseY - w * 0.03);
      ctx.quadraticCurveTo(x + Math.cos(ang) * hgt, baseY - w * 0.03 - hgt, x + Math.cos(ang) * hgt * 2, baseY - w * 0.02);
      ctx.stroke();
    }
  }
};

const power: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  if (tier === 1) {
    // 화력
    fillRR(ctx, x - w * 0.34, baseY - w * 0.2, w * 0.5, w * 0.2, 2, '#4a5468');
    for (let c = 0; c < 2; c++) {
      const chx = x - w * 0.24 + c * w * 0.22;
      fillRR(ctx, chx, baseY - w * 0.46, w * 0.09, w * 0.46, 1, '#5c6880');
      for (let i = 0; i < 4; i++) {
        const q = (t * 0.3 + i * 0.25 + c * 0.12) % 1;
        ctx.globalAlpha = (1 - q) * 0.35;
        ctx.fillStyle = '#cfd9ea';
        ctx.beginPath();
        ctx.arc(chx + w * 0.045, baseY - w * 0.48 - q * w * 0.28, w * (0.03 + q * 0.05), 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (tier === 2) {
    // 수력(댐)
    ctx.fillStyle = '#8895ab';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.4, baseY);
    ctx.lineTo(x - w * 0.28, baseY - w * 0.34);
    ctx.lineTo(x + w * 0.28, baseY - w * 0.34);
    ctx.lineTo(x + w * 0.4, baseY);
    ctx.fill();
    ctx.fillStyle = '#2f6f9e';
    ctx.fillRect(x - w * 0.24, baseY - w * 0.3, w * 0.48, w * 0.06);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(160,220,255,0.75)';
      ctx.fillRect(x - w * 0.16 + i * w * 0.14, baseY - w * 0.24, w * 0.05, w * 0.24);
    }
  } else if (tier === 3) {
    // 원자력
    ctx.fillStyle = '#8f9bb3';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.26, baseY);
    ctx.quadraticCurveTo(x - w * 0.1, baseY - w * 0.22, x - w * 0.14, baseY - w * 0.42);
    ctx.lineTo(x + w * 0.02, baseY - w * 0.42);
    ctx.quadraticCurveTo(x - w * 0.02, baseY - w * 0.22, x + w * 0.12, baseY);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.28 + i * 0.25) % 1;
      ctx.globalAlpha = (1 - q) * 0.4;
      ctx.fillStyle = '#dfe8f5';
      ctx.beginPath();
      ctx.arc(x - w * 0.06, baseY - w * 0.46 - q * w * 0.24, w * (0.04 + q * 0.06), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    fillRR(ctx, x + w * 0.16, baseY - w * 0.18, w * 0.24, w * 0.18, 3, '#5c6880');
  } else {
    // 신재생
    for (let i = 0; i < 4; i++) {
      const px = x - w * 0.42 + i * w * 0.16;
      ctx.fillStyle = '#2b3855';
      ctx.fillRect(px, baseY - w * 0.1, w * 0.13, w * 0.02);
      ctx.save();
      ctx.translate(px + w * 0.065, baseY - w * 0.11);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#3d7fd4';
      ctx.fillRect(-w * 0.06, -w * 0.02, w * 0.12, w * 0.035);
      ctx.restore();
    }
    // 풍력
    const wx = x + w * 0.3;
    ctx.strokeStyle = '#e8eef8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(wx, baseY);
    ctx.lineTo(wx, baseY - w * 0.44);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ang = t * 2.2 + (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx, baseY - w * 0.44);
      ctx.lineTo(wx + Math.cos(ang) * w * 0.12, baseY - w * 0.44 + Math.sin(ang) * w * 0.12);
      ctx.stroke();
    }
  }
  // 송전탑
  if (tier >= 2) {
    const px = x + w * 0.44;
    ctx.strokeStyle = '#7d879b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px - w * 0.05, baseY);
    ctx.lineTo(px, baseY - w * 0.3);
    ctx.lineTo(px + w * 0.05, baseY);
    ctx.moveTo(px - w * 0.06, baseY - w * 0.22);
    ctx.lineTo(px + w * 0.06, baseY - w * 0.22);
    ctx.stroke();
  }
};

const road: Painter = (a) => {
  const { ctx, x, baseY, w, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  // 관제소
  fillRR(ctx, x - w * 0.22, baseY - w * 0.26, w * 0.44, w * 0.26, 3, '#3c4658');
  windows(a, x - w * 0.18, baseY - w * 0.22, w * 0.36, w * 0.12, 3, 1, 81);
  // 신호등
  const sx = x + w * 0.3;
  ctx.fillStyle = '#2b3855';
  ctx.fillRect(sx - 2, baseY - w * 0.34, 4, w * 0.34);
  fillRR(ctx, sx - w * 0.045, baseY - w * 0.44, w * 0.09, w * 0.11, 3, '#1a2130');
  const phase = Math.floor(t * 0.7) % 3;
  const cols = ['#f87171', '#ffd166', '#4ade80'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = phase === i ? cols[i] : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(sx, baseY - w * 0.415 + i * w * 0.031, w * 0.012, 0, 7);
    ctx.fill();
  }
  if (tier >= 3) {
    ctx.fillStyle = '#4d5668';
    ctx.fillRect(x - w * 0.5, baseY - w * 0.5, w, w * 0.05);
    ctx.fillStyle = '#39414f';
    ctx.fillRect(x - w * 0.4, baseY - w * 0.45, w * 0.05, w * 0.45);
    ctx.fillRect(x + w * 0.35, baseY - w * 0.45, w * 0.05, w * 0.45);
  }
};

export const TOWN_PAINTERS: Record<BuildingId, Painter> = {
  mine,
  factory,
  fishery,
  park,
  corp,
  housing,
  shops,
  hospital,
  school,
  fire,
  police,
  green,
  power,
  road,
};

/** 거리를 걷는 시민 (인구에 따라 수가 는다) */
export function drawCitizens(
  ctx: Ctx2D,
  x0: number,
  x1: number,
  y: number,
  count: number,
  t: number,
  scale: number,
): void {
  const rand = seeded(1234);
  for (let i = 0; i < count; i++) {
    const base = rand();
    const dir = i % 2 === 0 ? 1 : -1;
    const span = x1 - x0 + 60;
    const q = ((t * (10 + base * 14) + base * span) % span) / span;
    const px = dir > 0 ? x0 - 30 + q * span : x1 + 30 - q * span;
    person(ctx, px, y, 15 * scale, {
      phase: t * 1.7 + base * 5,
      facing: dir as 1 | -1,
      body: ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0', '#d6a8f5'][i % 5],
    });
  }
}

/** 도로를 달리는 차 (도로 레벨에 따라 통행량 증가) */
export function drawCars(
  ctx: Ctx2D,
  x0: number,
  x1: number,
  y: number,
  count: number,
  t: number,
  night: boolean,
  scale: number,
): void {
  for (let i = 0; i < count; i++) {
    const base = seeded(i * 97 + 5)();
    const dir = i % 2 === 0 ? 1 : -1;
    const span = x1 - x0 + 120;
    const q = ((t * (40 + base * 55) + base * span) % span) / span;
    const cx = dir > 0 ? x0 - 60 + q * span : x1 + 60 - q * span;
    const cy = y + (dir > 0 ? 9 : -6) * scale;
    const col = ['#e63946', '#7ee0ff', '#ffd166', '#b8f2a0', '#f4978e', '#ffffff'][i % 6];
    const cw = 26 * scale;
    fillRR(ctx, cx, cy, cw, 9 * scale, 2.5 * scale, col);
    fillRR(ctx, cx + cw * 0.22, cy - 5 * scale, cw * 0.5, 6 * scale, 2 * scale, col);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(cx + cw * 0.24, cy + 9 * scale, 2.4 * scale, 0, 7);
    ctx.arc(cx + cw * 0.76, cy + 9 * scale, 2.4 * scale, 0, 7);
    ctx.fill();
    if (night) {
      ctx.fillStyle = 'rgba(255,240,180,0.55)';
      ctx.fillRect(dir > 0 ? cx + cw : cx - 10 * scale, cy + 2 * scale, 10 * scale, 2.4 * scale);
    }
  }
}

/** 출동한 소방차 */
export function drawFireTruck(ctx: Ctx2D, x: number, y: number, t: number, scale: number): void {
  const cw = 34 * scale;
  fillRR(ctx, x, y - 12 * scale, cw, 12 * scale, 2 * scale, '#d0342c');
  fillRR(ctx, x + cw * 0.68, y - 17 * scale, cw * 0.3, 8 * scale, 2 * scale, '#a3261f');
  ctx.fillStyle = Math.sin(t * 14) > 0 ? '#7ee0ff' : '#ff5a4a';
  ctx.fillRect(x + cw * 0.3, y - 16 * scale, 6 * scale, 3.5 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(x + cw * 0.22, y, 3 * scale, 0, 7);
  ctx.arc(x + cw * 0.78, y, 3 * scale, 0, 7);
  ctx.fill();
  void lerp;
  void vGradient;
}
