import type { FacilityId } from '../../data/buildings';
import { fillRR, person, pingpong, seeded, vGradient, type Ctx2D } from './gfx';

export interface FacArgs {
  ctx: Ctx2D;
  w: number;
  h: number;
  t: number;
  /** 총 레벨 기반 발전도 0~1 */
  dev: number;
  tier: number;
  /** 이 시설이 지금 부족한 상태인가 */
  strained: boolean;
}

type Painter = (a: FacArgs) => void;

const lit = (t: number, i: number, night = true) =>
  (Math.sin(t * 0.7 + i * 1.7) + 1) / 2 > 0.35 ? (night ? 'rgba(255,217,122,0.95)' : '#cfe4ff') : 'rgba(120,150,200,0.2)';

const housing: Painter = ({ ctx, w, h, t, dev, tier }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#16233c', '#3d4f70');
  ctx.fillRect(0, 0, w, h);
  const blocks = Math.min(4, Math.max(1, tier));
  const bw = (w * 0.86) / blocks;
  const groundY = h * 0.88;
  ctx.fillStyle = '#2b3548';
  ctx.fillRect(0, groundY, w, h - groundY);
  for (let b = 0; b < blocks; b++) {
    const bh = h * (0.34 + dev * 0.42) * (0.85 + ((b * 5) % 3) * 0.08);
    const bx = w * 0.07 + b * bw;
    fillRR(ctx, bx + 4, groundY - bh, bw - 8, bh, 3, '#8a7a5e');
    ctx.fillStyle = '#5c5344';
    ctx.fillRect(bx, groundY - bh - h * 0.02, bw, h * 0.02);
    const rows = Math.max(3, Math.round(bh / (h * 0.09)));
    const cols = Math.max(3, Math.round((bw - 20) / 26));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = lit(t, b * 10 + r * 3 + c);
        ctx.fillRect(bx + 12 + c * ((bw - 26) / cols), groundY - bh + 8 + r * (bh / rows), (bw - 26) / cols - 7, bh / rows - 7);
      }
    }
  }
  // 드나드는 사람
  const rand = seeded(11);
  for (let i = 0; i < 3 + Math.round(dev * 6); i++) {
    const base = rand();
    const dir = i % 2 === 0 ? 1 : -1;
    const x = dir > 0 ? ((t * 22 + base * w) % (w + 40)) - 20 : w + 20 - ((t * 22 + base * w) % (w + 40));
    person(ctx, x, groundY + h * 0.06, h * 0.13, { phase: t * 1.8 + base * 4, facing: dir as 1 | -1, body: ['#f4978e', '#7ee0ff', '#ffd166'][i % 3] });
  }
};

const shops: Painter = ({ ctx, w, h, t, dev, tier }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#2a1f3a', '#5d4a63');
  ctx.fillRect(0, 0, w, h);
  const groundY = h * 0.86;
  ctx.fillStyle = '#312a3d';
  ctx.fillRect(0, groundY, w, h - groundY);
  const stalls = 2 + tier;
  const sw = w / stalls;
  for (let i = 0; i < stalls; i++) {
    const sx = i * sw;
    fillRR(ctx, sx + 4, groundY - h * 0.38, sw - 8, h * 0.38, 3, '#4a3d55');
    ctx.fillStyle = i % 2 ? '#f4978e' : '#ffd166';
    ctx.fillRect(sx + 2, groundY - h * 0.26, sw - 4, h * 0.05);
    // 간판
    ctx.fillStyle = (Math.sin(t * 3 + i) + 1) / 2 > 0.3 ? 'rgba(255,120,200,0.95)' : 'rgba(255,120,200,0.35)';
    ctx.fillRect(sx + sw * 0.2, groundY - h * 0.36, sw * 0.6, h * 0.07);
    ctx.fillStyle = lit(t, i);
    ctx.fillRect(sx + sw * 0.25, groundY - h * 0.19, sw * 0.5, h * 0.14);
  }
  const rand = seeded(22);
  for (let i = 0; i < 3 + Math.round(dev * 8); i++) {
    const base = rand();
    const dir = i % 2 === 0 ? 1 : -1;
    const x = dir > 0 ? ((t * 24 + base * w) % (w + 40)) - 20 : w + 20 - ((t * 24 + base * w) % (w + 40));
    person(ctx, x, groundY + h * 0.08, h * 0.14, { phase: t * 1.9 + base * 4, facing: dir as 1 | -1, body: ['#b8f2a0', '#7ee0ff', '#ffd166', '#f4978e'][i % 4] });
  }
};

const hospital: Painter = ({ ctx, w, h, t, dev, strained }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#e8eef8', '#c4d2e6');
  ctx.fillRect(0, 0, w, h);
  const floorY = h * 0.84;
  ctx.fillStyle = '#aebdd4';
  ctx.fillRect(0, floorY, w, h - floorY);
  const beds = 2 + Math.round(dev * 4);
  for (let i = 0; i < beds; i++) {
    const bx = w * 0.06 + i * ((w * 0.62) / beds);
    fillRR(ctx, bx, floorY - h * 0.16, (w * 0.62) / beds - 8, h * 0.09, 3, '#f7fbff');
    ctx.fillStyle = '#7ee0ff';
    ctx.fillRect(bx + 4, floorY - h * 0.15, ((w * 0.62) / beds - 16) * 0.6, h * 0.05);
    // 모니터
    ctx.strokeStyle = (Math.sin(t * 4 + i) + 1) / 2 > 0.5 ? '#4ade80' : '#2f7a52';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k < 14; k++) {
      const x = bx + k * 3;
      const y = floorY - h * 0.2 + Math.sin(k * 1.4 + t * 6 + i) * 4;
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 구급차
  const q = (t * 0.25) % 1;
  const ax = w * 0.72 + q * w * 0.3;
  fillRR(ctx, ax, floorY - h * 0.13, w * 0.2, h * 0.11, 3, '#ffffff');
  ctx.fillStyle = '#e63946';
  ctx.fillRect(ax, floorY - h * 0.08, w * 0.2, h * 0.02);
  ctx.fillStyle = Math.sin(t * 12) > 0 ? '#7ee0ff' : '#f87171';
  ctx.fillRect(ax + w * 0.08, floorY - h * 0.16, w * 0.04, h * 0.03);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(ax + w * 0.05, floorY, 5, 0, 7);
  ctx.arc(ax + w * 0.16, floorY, 5, 0, 7);
  ctx.fill();
  if (strained) {
    ctx.fillStyle = 'rgba(248,113,113,0.16)';
    ctx.fillRect(0, 0, w, h);
  }
};

const school: Painter = ({ ctx, w, h, t, dev }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#c8a06a', '#8a6a44');
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f3e6cd';
  ctx.fillRect(w * 0.04, h * 0.08, w * 0.92, h * 0.72);
  // 칠판
  fillRR(ctx, w * 0.08, h * 0.14, w * 0.34, h * 0.3, 4, '#2f5142');
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.11, h * 0.2 + i * h * 0.07);
    ctx.lineTo(w * 0.11 + (w * 0.26) * (0.5 + 0.5 * pingpong(t * 0.3 + i * 0.2)), h * 0.2 + i * h * 0.07);
    ctx.stroke();
  }
  person(ctx, w * 0.5, h * 0.48, h * 0.2, { phase: 0, facing: -1, body: '#5b8def' });
  // 학생
  const rows = 2;
  const cols = 2 + Math.round(dev * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = w * (0.18 + c * (0.66 / cols));
      const y = h * (0.6 + r * 0.16);
      fillRR(ctx, x - w * 0.05, y, w * 0.1, h * 0.04, 2, '#a9825a');
      person(ctx, x, y, h * 0.13, { phase: Math.sin(t * 2 + r + c) * 0.1, facing: -1, body: ['#b8f2a0', '#f4978e', '#7ee0ff'][(r + c) % 3] });
    }
  }
};

const fire: Painter = ({ ctx, w, h, t, dev, strained }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#5a1f18', '#2a1210');
  ctx.fillRect(0, 0, w, h);
  const floorY = h * 0.86;
  ctx.fillStyle = '#3a2b28';
  ctx.fillRect(0, floorY, w, h - floorY);
  const bays = 1 + Math.min(3, Math.round(dev * 3));
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const bx = i * bw;
    fillRR(ctx, bx + 6, h * 0.24, bw - 12, floorY - h * 0.24, 4, '#1d1210');
    // 소방차
    const out = strained && i === 0 ? Math.min(1, (t % 3) / 1.2) : 0;
    const cx = bx + 14 + out * bw * 0.7;
    fillRR(ctx, cx, floorY - h * 0.2, bw * 0.6, h * 0.14, 3, '#d0342c');
    fillRR(ctx, cx + bw * 0.42, floorY - h * 0.27, bw * 0.2, h * 0.09, 2, '#a3261f');
    ctx.fillStyle = Math.sin(t * 12) > 0 ? '#7ee0ff' : '#ff5a4a';
    ctx.fillRect(cx + bw * 0.2, floorY - h * 0.25, bw * 0.1, h * 0.04);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(cx + bw * 0.14, floorY - h * 0.05, 6, 0, 7);
    ctx.arc(cx + bw * 0.46, floorY - h * 0.05, 6, 0, 7);
    ctx.fill();
  }
  person(ctx, w * 0.08, floorY + h * 0.09, h * 0.16, { phase: t * 1.2, facing: 1, body: '#fb923c' });
};

const police: Painter = ({ ctx, w, h, t, dev }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#101a30', '#1d2a48');
  ctx.fillRect(0, 0, w, h);
  // 배치도 격자
  ctx.strokeStyle = 'rgba(126,224,255,0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += w / 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += h / 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // 순찰 경로
  const cars = 1 + Math.round(dev * 5);
  for (let i = 0; i < cars; i++) {
    const laneY = h * (0.2 + (i % 4) * 0.2);
    const dir = i % 2 === 0 ? 1 : -1;
    const q = ((t * (30 + i * 12)) % (w + 60)) / (w + 60);
    const x = dir > 0 ? q * (w + 60) - 30 : w + 30 - q * (w + 60);
    fillRR(ctx, x, laneY, 26, 10, 3, '#e8eef8');
    ctx.fillStyle = '#3a5288';
    ctx.fillRect(x, laneY + 3, 26, 4);
    ctx.fillStyle = Math.sin(t * 10 + i) > 0 ? '#5b8def' : '#e63946';
    ctx.fillRect(x + 9, laneY - 4, 8, 4);
  }
  ctx.fillStyle = 'rgba(91,141,239,0.9)';
  ctx.font = `700 ${Math.round(h * 0.08)}px system-ui, sans-serif`;
  ctx.fillText('순찰 중', w * 0.04, h * 0.13);
};

const green: Painter = ({ ctx, w, h, t, dev, tier }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#7fb8e8', '#a7d8b4');
  ctx.fillRect(0, 0, w, h);
  const groundY = h * 0.5;
  ctx.fillStyle = '#3f9a63';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = '#c9b391';
  ctx.fillRect(0, h * 0.78, w, h * 0.1);
  const rand = seeded(44);
  for (let i = 0; i < 4 + tier * 3; i++) {
    const tx = rand() * w;
    const th = h * (0.12 + rand() * 0.1);
    ctx.fillStyle = '#5a3d24';
    ctx.fillRect(tx - 2, groundY + h * 0.06 - th, 4, th);
    ctx.fillStyle = '#2f8a56';
    ctx.beginPath();
    ctx.arc(tx, groundY + h * 0.06 - th - h * 0.04, h * 0.07, 0, 7);
    ctx.fill();
  }
  // 분수
  if (tier >= 2) {
    const fx = w * 0.5;
    const fy = groundY + h * 0.16;
    ctx.fillStyle = '#6aa9d8';
    ctx.beginPath();
    ctx.ellipse(fx, fy, w * 0.11, h * 0.045, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.9)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI / 2 + (i - 2.5) * 0.28;
      const hgt = h * (0.1 + Math.abs(Math.sin(t * 2 + i)) * 0.05);
      ctx.beginPath();
      ctx.moveTo(fx, fy - h * 0.02);
      ctx.quadraticCurveTo(fx + Math.cos(ang) * hgt, fy - h * 0.02 - hgt, fx + Math.cos(ang) * hgt * 2, fy);
      ctx.stroke();
    }
  }
  const r2 = seeded(45);
  for (let i = 0; i < 3 + Math.round(dev * 7); i++) {
    const base = r2();
    const dir = i % 2 === 0 ? 1 : -1;
    const x = dir > 0 ? ((t * 18 + base * w) % (w + 40)) - 20 : w + 20 - ((t * 18 + base * w) % (w + 40));
    person(ctx, x, h * 0.86, h * 0.13, { phase: t * 1.6 + base * 4, facing: dir as 1 | -1, body: ['#f4978e', '#ffd166', '#7ee0ff', '#ffffff'][i % 4] });
  }
};

const power: Painter = ({ ctx, w, h, t, dev, tier, strained }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#101a2e', '#22304a');
  ctx.fillRect(0, 0, w, h);
  const floorY = h * 0.82;
  ctx.fillStyle = '#1a2438';
  ctx.fillRect(0, floorY, w, h - floorY);
  const gens = 1 + Math.min(4, Math.round(dev * 4));
  for (let i = 0; i < gens; i++) {
    const gx = w * 0.06 + i * ((w * 0.62) / gens);
    const gw = (w * 0.62) / gens - 10;
    fillRR(ctx, gx, floorY - h * 0.34, gw, h * 0.34, 4, '#3d4f75');
    ctx.save();
    ctx.translate(gx + gw / 2, floorY - h * 0.17);
    ctx.rotate(t * (strained ? 1.2 : 3.4) + i);
    ctx.strokeStyle = '#7ee0ff';
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * gw * 0.28, Math.sin(a) * gw * 0.28);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = strained ? '#f87171' : '#4ade80';
    ctx.fillRect(gx + 6, floorY - h * 0.38, gw - 12, 5);
  }
  // 전력 게이지
  const gx = w * 0.74;
  fillRR(ctx, gx, h * 0.12, w * 0.2, h * 0.68, 8, 'rgba(6,12,24,0.7)');
  const level = strained ? 0.3 + 0.1 * Math.sin(t * 6) : 0.72 + 0.18 * Math.sin(t * 1.6);
  const gh = h * 0.68 * level;
  fillRR(ctx, gx + 4, h * 0.12 + h * 0.68 - gh, w * 0.2 - 8, gh, 6, strained ? '#f87171' : '#7ee0ff');
  ctx.fillStyle = '#eaf1ff';
  ctx.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('전력', gx + w * 0.1, h * 0.09);
  ctx.textAlign = 'left';
  if (tier >= 4) {
    ctx.fillStyle = 'rgba(74,222,128,0.9)';
    ctx.fillText('신재생', w * 0.06, h * 0.1);
  }
};

const road: Painter = ({ ctx, w, h, t, dev, tier }) => {
  ctx.fillStyle = vGradient(ctx, 0, h, '#0f1626', '#1b2740');
  ctx.fillRect(0, 0, w, h);
  const lanes = 2 + Math.min(4, Math.round(dev * 4));
  for (let i = 0; i < lanes; i++) {
    const y = h * (0.18 + (i * 0.62) / lanes);
    ctx.fillStyle = '#252c3b';
    ctx.fillRect(0, y, w, h * 0.09);
    ctx.fillStyle = 'rgba(160,180,215,0.5)';
    const off = (t * 60) % 30;
    for (let x = -off; x < w; x += 30) ctx.fillRect(x, y + h * 0.042, 14, 2);
    const cars = 2 + tier;
    for (let c = 0; c < cars; c++) {
      const base = (c * 37 + i * 13) % 100 / 100;
      const dir = i % 2 === 0 ? 1 : -1;
      const q = ((t * (45 + base * 45) + base * w) % (w + 60)) / (w + 60);
      const x = dir > 0 ? q * (w + 60) - 30 : w + 30 - q * (w + 60);
      fillRR(ctx, x, y + h * 0.015, 22, 8, 2, ['#e63946', '#7ee0ff', '#ffd166', '#b8f2a0'][c % 4]);
    }
  }
  // 신호등
  const sx = w * 0.9;
  fillRR(ctx, sx, h * 0.08, w * 0.07, h * 0.2, 5, '#1a2130');
  const phase = Math.floor(t * 0.7) % 3;
  const cols = ['#f87171', '#ffd166', '#4ade80'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = phase === i ? cols[i] : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(sx + w * 0.035, h * 0.11 + i * h * 0.06, w * 0.017, 0, 7);
    ctx.fill();
  }
};

export const FACILITY_SCENES: Record<FacilityId, Painter> = {
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
