import { cityTier } from '../../core/progression';
import type { BusinessDef } from '../../core/types';
import { fillRR, lerp, seeded, vGradient, type Ctx2D } from './gfx';

const SKIES: [string, string][] = [
  ['#2b4a7a', '#7fa8cf'],
  ['#1e3f6e', '#6f9ec9'],
  ['#33345f', '#8a6ea8'],
  ['#1d1f43', '#4b3a72'],
  ['#141633', '#33265c'],
  ['#0b0e22', '#2a1a4d'],
];

interface Building {
  x: number;
  w: number;
  h: number;
  shade: number;
  seed: number;
}

/**
 * 도시 전경. 레벨이 오르면 건물이 늘고 높아지고 밤이 되고 랜드마크가 선다.
 * "빈 땅 -> 도시" 가 이 게임의 광고 소재이자 진행 피드백이므로 홈 화면의 주인공으로 둔다.
 */
export function drawCity(
  ctx: Ctx2D,
  w: number,
  h: number,
  level: number,
  unlocked: BusinessDef[],
  t: number,
): void {
  const tier = cityTier(level);
  const [c0, c1] = SKIES[tier];
  const night = tier >= 3;
  const density = Math.min(1, level / 34);
  const groundY = h * 0.8;
  const rand = seeded(20260818);

  ctx.fillStyle = vGradient(ctx, 0, groundY, c0, c1);
  ctx.fillRect(0, 0, w, groundY);

  // 별
  if (night) {
    for (let i = 0; i < 46; i++) {
      const x = rand() * w;
      const y = rand() * groundY * 0.62;
      const tw = 0.35 + 0.65 * ((Math.sin(t * 1.6 + i * 2.1) + 1) / 2);
      ctx.globalAlpha = tw * 0.85;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // 해 / 달
  const cx = w * 0.82;
  const cy = h * 0.2;
  if (night) {
    ctx.fillStyle = '#f4f1e0';
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.075, 0, 7);
    ctx.fill();
    ctx.fillStyle = c0;
    ctx.beginPath();
    ctx.arc(cx - h * 0.035, cy - h * 0.025, h * 0.075, 0, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,217,138,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.085, 0, 7);
    ctx.fill();
  }

  // 구름
  for (let i = 0; i < 3; i++) {
    const base = rand();
    const cxx = ((t * (4 + base * 6) + base * w * 2) % (w + 140)) - 70;
    const cyy = h * (0.1 + base * 0.2);
    ctx.globalAlpha = night ? 0.12 : 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cxx, cyy, h * 0.05, 0, 7);
    ctx.arc(cxx + h * 0.05, cyy + h * 0.01, h * 0.038, 0, 7);
    ctx.arc(cxx - h * 0.045, cyy + h * 0.012, h * 0.033, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 원경 언덕
  ctx.fillStyle = 'rgba(9,15,28,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.bezierCurveTo(w * 0.2, groundY - h * 0.16, w * 0.42, groundY - h * 0.04, w * 0.6, groundY - h * 0.12);
  ctx.bezierCurveTo(w * 0.8, groundY - h * 0.2, w * 0.9, groundY - h * 0.05, w, groundY - h * 0.1);
  ctx.lineTo(w, groundY);
  ctx.fill();

  // 건물
  const count = Math.round(2 + density * 28);
  const buildings: Building[] = [];
  let x = w * 0.02;
  for (let i = 0; i < count; i++) {
    const bw = w * (0.035 + rand() * 0.05);
    const maxH = h * (0.14 + density * 0.56);
    const bh = h * 0.08 + rand() * maxH;
    buildings.push({ x, w: bw, h: bh, shade: 14 + Math.floor(rand() * 18), seed: rand() * 1000 });
    x += bw + w * (0.006 + rand() * 0.016);
    if (x > w * 0.98) break;
  }
  for (const b of buildings) {
    const top = groundY - b.h;
    ctx.fillStyle = `rgb(${b.shade},${b.shade + 9},${b.shade + 24})`;
    ctx.fillRect(b.x, top, b.w, b.h);
    ctx.fillStyle = `rgb(${b.shade + 8},${b.shade + 17},${b.shade + 33})`;
    ctx.fillRect(b.x, top, b.w * 0.25, b.h);
    const cols = Math.max(1, Math.floor(b.w / 8));
    const rows = Math.max(1, Math.floor(b.h / 10));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = b.seed + r * 7 + c * 13;
        const on = (Math.sin(t * 0.5 + seed) + 1) / 2 > (night ? 0.32 : 0.68);
        if (!on) continue;
        ctx.fillStyle = night ? 'rgba(255,214,120,0.92)' : 'rgba(200,228,255,0.6)';
        ctx.fillRect(b.x + 3 + c * 8, top + 5 + r * 10, 3.2, 4.2);
      }
    }
  }

  // 코퍼레이트 타워는 스카이라인 층에 그린다
  const has = (id: string) => unlocked.some((u) => u.id === id);
  if (has('corp')) {
    const tx = w * 0.46;
    const tw = w * 0.075;
    const th = h * 0.62;
    ctx.fillStyle = '#2a3556';
    ctx.fillRect(tx, groundY - th, tw, th);
    ctx.fillStyle = '#8b6df0';
    ctx.fillRect(tx, groundY - th, tw, 3);
    for (let f = 0; f < 16; f++) {
      for (let c = 0; c < 2; c++) {
        const on = (Math.sin(t * 1.1 + f * 1.9 + c) + 1) / 2 > 0.4;
        ctx.fillStyle = on ? 'rgba(255,217,122,0.92)' : 'rgba(126,224,255,0.14)';
        ctx.fillRect(tx + 4 + (c * (tw - 8)) / 2, groundY - th + 9 + f * (th / 17), (tw - 12) / 2, 4.5);
      }
    }
    ctx.fillStyle = Math.sin(t * 3) > 0 ? '#f87171' : 'rgba(248,113,113,0.2)';
    ctx.beginPath();
    ctx.arc(tx + tw / 2, groundY - th - 3, 2.6, 0, 7);
    ctx.fill();
  }

  // 지면 + 도로
  ctx.fillStyle = '#101827';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = '#1b2740';
  ctx.fillRect(0, groundY + (h - groundY) * 0.32, w, (h - groundY) * 0.45);
  ctx.fillStyle = 'rgba(120,150,200,0.55)';
  const dash = 22;
  const off = (t * 26) % dash;
  for (let dx = -off; dx < w; dx += dash) {
    ctx.fillRect(dx, groundY + (h - groundY) * 0.53, 11, 2);
  }

  // 자동차
  const carN = 2 + Math.round(density * 4);
  for (let i = 0; i < carN; i++) {
    const base = seeded(i * 91 + 3)();
    const dir = i % 2 === 0 ? 1 : -1;
    const speed = 30 + base * 40;
    const q = ((t * speed + base * w * 2) % (w + 60)) / (w + 60);
    const cxp = dir > 0 ? q * (w + 60) - 30 : w + 30 - q * (w + 60);
    const cyp = groundY + (h - groundY) * (dir > 0 ? 0.62 : 0.38);
    const col = ['#e63946', '#7ee0ff', '#ffd166', '#b8f2a0', '#f4978e'][i % 5];
    fillRR(ctx, cxp, cyp, 20, 7, 2, col);
    fillRR(ctx, cxp + 4, cyp - 4, 11, 5, 2, col);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(cxp + 5, cyp + 7, 2, 0, 7);
    ctx.arc(cxp + 15, cyp + 7, 2, 0, 7);
    ctx.fill();
    if (night) {
      ctx.fillStyle = 'rgba(255,240,180,0.5)';
      ctx.fillRect(dir > 0 ? cxp + 20 : cxp - 8, cyp + 1, 8, 2);
    }
  }

  // ── 전경 랜드마크 (도로 앞. 해금할수록 도시가 채워진다) ──
  const fgY = h * 0.985;
  if (has('mine')) {
    const mx = w * 0.09;
    const mh = h * 0.24;
    ctx.strokeStyle = '#b39a70';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx - 15, fgY);
    ctx.lineTo(mx, fgY - mh);
    ctx.lineTo(mx + 15, fgY);
    ctx.moveTo(mx - 10, fgY - mh * 0.45);
    ctx.lineTo(mx + 10, fgY - mh * 0.45);
    ctx.stroke();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(mx, fgY - mh, h * 0.042, 0, 7);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i / 3) * Math.PI * 2;
      ctx.moveTo(mx, fgY - mh);
      ctx.lineTo(mx + Math.cos(a) * h * 0.042, fgY - mh + Math.sin(a) * h * 0.042);
    }
    ctx.stroke();
  }
  if (has('factory')) {
    const fx = w * 0.26;
    const fw = w * 0.13;
    const fh = h * 0.13;
    fillRR(ctx, fx, fgY - fh, fw, fh, 2, '#33456b');
    ctx.fillStyle = '#243450';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(fx + (i * fw) / 3, fgY - fh);
      ctx.lineTo(fx + (i * fw) / 3 + fw / 6, fgY - fh - h * 0.03);
      ctx.lineTo(fx + ((i + 1) * fw) / 3, fgY - fh);
      ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(255,217,122,0.85)';
      ctx.fillRect(fx + 4 + i * (fw / 4.4), fgY - fh * 0.6, fw / 9, fh * 0.3);
    }
    const chx = fx + fw + 4;
    fillRR(ctx, chx, fgY - h * 0.24, w * 0.022, h * 0.24, 1, '#3d4f75');
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.3 + i * 0.25) % 1;
      ctx.globalAlpha = (1 - q) * 0.4;
      ctx.fillStyle = '#cfd9ea';
      ctx.beginPath();
      ctx.arc(chx + w * 0.011 + Math.sin(q * 4 + i) * 6, fgY - h * 0.26 - q * h * 0.2, 4 + q * 9, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (has('park')) {
    const px = w * 0.72;
    const r = h * 0.13;
    const py = fgY - r - h * 0.04;
    ctx.strokeStyle = '#cbd6ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - r * 0.5, fgY);
    ctx.lineTo(px, py);
    ctx.lineTo(px + r * 0.5, fgY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,209,102,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 7);
    ctx.stroke();
    const spin = t * 0.9;
    for (let i = 0; i < 8; i++) {
      const a = spin + (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      ctx.stroke();
      fillRR(ctx, px + Math.cos(a) * r - 3.5, py + Math.sin(a) * r, 7, 6, 2, ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0'][i % 4]);
    }
  }

  // 항구 (어항 해금 시)
  if (has('fishery')) {
    const hx = w * 0.88;
    ctx.fillStyle = '#0f3a56';
    ctx.fillRect(hx, fgY - h * 0.1, w - hx, h * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2;
    for (let r = 0; r < 2; r++) {
      ctx.beginPath();
      for (let x = hx; x <= w; x += 5) {
        const y = fgY - h * 0.075 + r * 7 + Math.sin(x / 12 + t * 1.6) * 1.6;
        x === hx ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const bx = hx + 6 + Math.sin(t * 0.6) * 4;
    ctx.fillStyle = '#e2e8f4';
    ctx.beginPath();
    ctx.moveTo(bx, fgY - h * 0.08);
    ctx.lineTo(bx + 26, fgY - h * 0.08);
    ctx.lineTo(bx + 22, fgY - h * 0.035);
    ctx.lineTo(bx + 4, fgY - h * 0.035);
    ctx.fill();
    ctx.strokeStyle = '#cbd6ea';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx + 7, fgY - h * 0.08);
    ctx.lineTo(bx + 7, fgY - h * 0.2);
    ctx.stroke();
    ctx.fillStyle = '#22a2a2';
    ctx.beginPath();
    ctx.moveTo(bx + 8, fgY - h * 0.2);
    ctx.lineTo(bx + 22, fgY - h * 0.16);
    ctx.lineTo(bx + 8, fgY - h * 0.13);
    ctx.fill();
  }

  // 초반: 빈 땅 안내
  if (level <= 2) {
    ctx.fillStyle = 'rgba(6,10,20,0.42)';
    fillRR(ctx, w * 0.34, h * 0.62, w * 0.32, h * 0.1, 999, 'rgba(6,10,20,0.42)');
    ctx.fillStyle = 'rgba(233,241,255,0.92)';
    ctx.font = `700 ${Math.round(h * 0.058)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('여기가 당신의 땅입니다', w * 0.5, h * 0.67);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  void lerp;
}
