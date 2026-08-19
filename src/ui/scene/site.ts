import type { BusinessId } from '../../core/types';
import { fillRR, lerp, person, pingpong, seeded, vGradient, type Ctx2D } from './gfx';

export interface SiteArgs {
  ctx: Ctx2D;
  w: number;
  h: number;
  t: number;
  /** 개발 정도 0~1 (보유 유닛/레벨 기반) — 사업장이 실제로 커진다 */
  dev: number;
  boosted: boolean;
  /** 가동률 */
  eff: number;
}

type SitePainter = (a: SiteArgs) => void;

const mineSite: SitePainter = ({ ctx, w, h, t, dev, boosted }) => {
  const groundY = h * 0.74;
  ctx.fillStyle = vGradient(ctx, 0, groundY, '#16233c', '#5a6f92');
  ctx.fillRect(0, 0, w, groundY);
  // 별
  const rand = seeded(4242);
  for (let i = 0; i < 20; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.5;
    ctx.fillStyle = '#fff';
    ctx.fillRect(rand() * w, rand() * groundY * 0.55, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;

  // 산
  ctx.fillStyle = '#1a2438';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w * 0.2, groundY - h * 0.4);
  ctx.lineTo(w * 0.42, groundY);
  ctx.moveTo(w * 0.5, groundY);
  ctx.lineTo(w * 0.74, groundY - h * 0.52);
  ctx.lineTo(w * 1.02, groundY);
  ctx.fill();
  // 갱 입구
  ctx.fillStyle = '#0b0805';
  ctx.beginPath();
  ctx.moveTo(w * 0.66, groundY);
  ctx.lineTo(w * 0.66, groundY - h * 0.13);
  ctx.quadraticCurveTo(w * 0.72, groundY - h * 0.2, w * 0.78, groundY - h * 0.13);
  ctx.lineTo(w * 0.78, groundY);
  ctx.fill();
  ctx.strokeStyle = '#7a5f3c';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 지면
  ctx.fillStyle = vGradient(ctx, groundY, h, '#5c4833', '#33271c');
  ctx.fillRect(0, groundY, w, h - groundY);

  // 권양탑
  const tx = w * 0.2;
  const th = h * 0.46 * (0.62 + dev * 0.38);
  ctx.strokeStyle = '#b39a70';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx - 16, groundY);
  ctx.lineTo(tx, groundY - th);
  ctx.lineTo(tx + 16, groundY);
  ctx.moveTo(tx - 11, groundY - th * 0.45);
  ctx.lineTo(tx + 11, groundY - th * 0.45);
  ctx.moveTo(tx - 16, groundY);
  ctx.lineTo(tx + 11, groundY - th * 0.45);
  ctx.stroke();
  const spin = t * (boosted ? 5 : 2.2) * (0.5 + dev);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(tx, groundY - th, h * 0.075, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = spin + (i / 3) * Math.PI * 2;
    ctx.moveTo(tx, groundY - th);
    ctx.lineTo(tx + Math.cos(a) * h * 0.075, groundY - th + Math.sin(a) * h * 0.075);
  }
  ctx.stroke();
  // 작업등
  const lg = ctx.createRadialGradient(tx, groundY - th * 0.45, 2, tx, groundY - th * 0.45, h * 0.5);
  lg.addColorStop(0, 'rgba(255,214,130,0.35)');
  lg.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(tx, groundY - th * 0.45, h * 0.5, 0, 7);
  ctx.fill();

  // 광석 더미
  const pile = h * 0.08 + dev * h * 0.16;
  ctx.fillStyle = '#4e6b66';
  ctx.beginPath();
  ctx.moveTo(w * 0.36, groundY + h * 0.02);
  ctx.lineTo(w * 0.46, groundY - pile);
  ctx.lineTo(w * 0.56, groundY + h * 0.02);
  ctx.fill();
  ctx.fillStyle = '#8ad6c8';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.4 + rand() * w * 0.13, groundY - pile * (0.15 + rand() * 0.7), 2.6, 0, 7);
    ctx.fill();
  }

  // 작업자
  person(ctx, w * 0.3, groundY + h * 0.06, h * 0.2, { phase: t * 1.2, facing: 1, body: '#f4a261' });
  if (dev > 0.4) person(ctx, w * 0.6, groundY + h * 0.06, h * 0.2, { phase: t * 1.5 + 0.4, facing: -1, body: '#e9c46a' });

  // 트럭 (화면 안에서 오간다)
  const q = (t * 0.1) % 1;
  const trx = lerp(-w * 0.2, w * 1.02, q);
  const trW = w * 0.17;
  fillRR(ctx, trx, groundY + h * 0.02 - h * 0.13, trW, h * 0.1, 2, '#c98a3c');
  fillRR(ctx, trx + trW * 0.72, groundY + h * 0.02 - h * 0.17, trW * 0.3, h * 0.14, 2, '#8a6228');
  ctx.fillStyle = '#12100c';
  ctx.beginPath();
  ctx.arc(trx + trW * 0.22, groundY + h * 0.03, 3.4, 0, 7);
  ctx.arc(trx + trW * 0.8, groundY + h * 0.03, 3.4, 0, 7);
  ctx.fill();
};

const factorySite: SitePainter = ({ ctx, w, h, t, dev, eff }) => {
  const groundY = h * 0.78;
  ctx.fillStyle = vGradient(ctx, 0, groundY, '#1b2740', '#405a86');
  ctx.fillRect(0, 0, w, groundY);
  ctx.fillStyle = '#22304a';
  ctx.fillRect(0, groundY, w, h - groundY);

  // 공장 본체
  const bw = w * 0.5;
  const bh = h * 0.4 * (0.7 + dev * 0.3);
  const bx = w * 0.14;
  fillRR(ctx, bx, groundY - bh, bw, bh, 2, '#33456b');
  // 톱니 지붕
  ctx.fillStyle = '#243450';
  for (let i = 0; i < 4; i++) {
    const sx = bx + (i * bw) / 4;
    ctx.beginPath();
    ctx.moveTo(sx, groundY - bh);
    ctx.lineTo(sx + bw / 8, groundY - bh - h * 0.08);
    ctx.lineTo(sx + bw / 4, groundY - bh);
    ctx.fill();
  }
  // 창문
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i / 6 < eff ? 'rgba(255,217,122,0.85)' : 'rgba(126,224,255,0.18)';
    ctx.fillRect(bx + 8 + i * (bw / 6.6), groundY - bh * 0.55, bw / 11, bh * 0.3);
  }
  // 굴뚝 + 연기
  const chx = bx + bw + w * 0.06;
  fillRR(ctx, chx, groundY - h * 0.55, w * 0.06, h * 0.55, 2, '#3d4f75');
  ctx.fillStyle = '#556a94';
  ctx.fillRect(chx - 2, groundY - h * 0.57, w * 0.07, h * 0.04);
  for (let i = 0; i < 5; i++) {
    const q = ((t * 0.35 + i * 0.2) % 1);
    ctx.globalAlpha = (1 - q) * 0.42 * (0.4 + dev * 0.6);
    ctx.fillStyle = '#cfd9ea';
    ctx.beginPath();
    ctx.arc(chx + w * 0.03 + Math.sin(q * 4 + i) * 8, groundY - h * 0.6 - q * h * 0.42, 5 + q * 12, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const fisherySite: SitePainter = ({ ctx, w, h, t, dev }) => {
  const seaY = h * 0.62;
  ctx.fillStyle = vGradient(ctx, 0, seaY, '#25405f', '#7ba3c9');
  ctx.fillRect(0, 0, w, seaY);
  ctx.fillStyle = vGradient(ctx, seaY, h, '#1b5e83', '#0a2f47');
  ctx.fillRect(0, seaY, w, h - seaY);

  // 등대
  const lx = w * 0.14;
  ctx.fillStyle = '#e9e4f0';
  ctx.beginPath();
  ctx.moveTo(lx - 8, seaY);
  ctx.lineTo(lx - 5, seaY - h * 0.42);
  ctx.lineTo(lx + 5, seaY - h * 0.42);
  ctx.lineTo(lx + 8, seaY);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(lx - 7, seaY - h * 0.3, 14, h * 0.06);
  const beam = (Math.sin(t * 1.6) + 1) / 2;
  ctx.globalAlpha = 0.25 + beam * 0.5;
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(lx, seaY - h * 0.45);
  ctx.lineTo(w, seaY - h * 0.62 + beam * h * 0.5);
  ctx.lineTo(w, seaY - h * 0.2 + beam * h * 0.5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(lx, seaY - h * 0.45, 4, 0, 7);
  ctx.fill();

  // 파도
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = seaY + 8 + r * 11 + Math.sin(x / 24 + t * (1 + r * 0.4)) * 2.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 정박한 배들
  const boats = 1 + Math.round(dev * 3);
  for (let i = 0; i < boats; i++) {
    const bx = w * 0.42 + i * w * 0.15;
    const by = seaY + 6 + Math.sin(t * 2 + i) * 2;
    ctx.fillStyle = '#e2e8f4';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + w * 0.11, by);
    ctx.lineTo(bx + w * 0.09, by + h * 0.08);
    ctx.lineTo(bx + w * 0.02, by + h * 0.08);
    ctx.fill();
    ctx.strokeStyle = '#cbd6ea';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + w * 0.03, by);
    ctx.lineTo(bx + w * 0.03, by - h * 0.2);
    ctx.stroke();
  }

  // 갈매기
  const rand = seeded(9);
  for (let i = 0; i < 4; i++) {
    const base = rand();
    const gx = ((t * (14 + base * 12) + base * w) % (w + 40)) - 20;
    const gy = h * 0.12 + base * h * 0.25;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.4;
    const flap = Math.sin(t * 6 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(gx - 5, gy + flap);
    ctx.quadraticCurveTo(gx, gy - 3, gx + 5, gy + flap);
    ctx.stroke();
  }
};

const parkSite: SitePainter = ({ ctx, w, h, t, dev, boosted }) => {
  const groundY = h * 0.8;
  ctx.fillStyle = vGradient(ctx, 0, groundY, '#3a2a5e', '#8a5a9c');
  ctx.fillRect(0, 0, w, groundY);
  ctx.fillStyle = '#2b7a52';
  ctx.fillRect(0, groundY, w, h - groundY);

  // 대관람차 (배경)
  const cx = w * 0.78;
  const cy = groundY - h * 0.34;
  const r = h * 0.28;
  ctx.strokeStyle = 'rgba(255,209,102,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const spin = t * (boosted ? 1.6 : 0.7);
  for (let i = 0; i < 8; i++) {
    const a = spin + (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
    fillRR(ctx, cx + Math.cos(a) * r - 3, cy + Math.sin(a) * r, 6, 5, 2, ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0'][i % 4]);
  }

  // 입구 게이트
  const gx = w * 0.1;
  const gw = w * 0.34;
  ctx.fillStyle = '#e0629b';
  ctx.fillRect(gx, groundY - h * 0.36, 8, h * 0.36);
  ctx.fillRect(gx + gw, groundY - h * 0.36, 8, h * 0.36);
  ctx.beginPath();
  ctx.moveTo(gx, groundY - h * 0.36);
  ctx.quadraticCurveTo(gx + gw / 2 + 4, groundY - h * 0.58, gx + gw + 8, groundY - h * 0.36);
  ctx.lineTo(gx + gw + 8, groundY - h * 0.28);
  ctx.quadraticCurveTo(gx + gw / 2 + 4, groundY - h * 0.5, gx, groundY - h * 0.28);
  ctx.fill();
  // 전구
  for (let i = 0; i <= 6; i++) {
    const q = i / 6;
    const bx = gx + q * (gw + 8);
    const by = groundY - h * 0.36 - Math.sin(q * Math.PI) * h * 0.19;
    ctx.fillStyle = Math.sin(t * 4 + i) > 0 ? '#ffe08a' : '#ffb703';
    ctx.beginPath();
    ctx.arc(bx, by, 2.6, 0, 7);
    ctx.fill();
  }

  // 산책로 + 나무 + 관람객
  ctx.fillStyle = '#c9b391';
  ctx.fillRect(0, groundY + (h - groundY) * 0.45, w, (h - groundY) * 0.4);
  for (let i = 0; i < 4; i++) {
    const txx = w * 0.06 + i * w * 0.24;
    ctx.fillStyle = '#5a3d24';
    ctx.fillRect(txx, groundY - h * 0.07, 3, h * 0.07);
    ctx.fillStyle = '#2f8a56';
    ctx.beginPath();
    ctx.arc(txx + 1.5, groundY - h * 0.09, h * 0.05, 0, 7);
    ctx.fill();
  }
  const visitors = 2 + Math.round(dev * 4);
  for (let i = 0; i < visitors; i++) {
    const base = seeded(i * 41 + 3)();
    const dir = i % 2 === 0 ? 1 : -1;
    const vx = dir > 0
      ? ((t * (12 + base * 10) + base * w) % (w + 30)) - 15
      : w + 15 - ((t * (12 + base * 10) + base * w) % (w + 30));
    person(ctx, vx, groundY + (h - groundY) * 0.82, h * 0.16, {
      phase: t * 1.6 + base * 3,
      facing: dir as 1 | -1,
      body: ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0'][i % 4],
    });
  }

  // 풍선
  const balloons = 1 + Math.round(dev * 4);
  const rand = seeded(31);
  for (let i = 0; i < balloons; i++) {
    const base = rand();
    const bx = w * 0.05 + base * w * 0.9;
    const by = groundY - h * 0.2 - ((t * 8 + base * 100) % (h * 0.7));
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by + 6);
    ctx.lineTo(bx, by + 14);
    ctx.stroke();
    ctx.fillStyle = ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0', '#d6a8f5'][i % 5];
    ctx.beginPath();
    ctx.ellipse(bx, by, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

const corpSite: SitePainter = ({ ctx, w, h, t, dev }) => {
  const groundY = h * 0.9;
  ctx.fillStyle = vGradient(ctx, 0, groundY, '#0e1428', '#2a2f52');
  ctx.fillRect(0, 0, w, groundY);
  ctx.fillStyle = '#0b111c';
  ctx.fillRect(0, groundY, w, h - groundY);

  // 배경 빌딩
  const rand = seeded(77);
  for (let i = 0; i < 9; i++) {
    const bw = w * 0.07 + rand() * w * 0.05;
    const bx = i * (w / 9);
    const bh = h * (0.2 + rand() * 0.35);
    ctx.fillStyle = 'rgba(12,18,34,0.9)';
    ctx.fillRect(bx, groundY - bh, bw, bh);
    for (let k = 0; k < 6; k++) {
      if (rand() > 0.5) continue;
      ctx.fillStyle = 'rgba(255,217,122,0.35)';
      ctx.fillRect(bx + 3 + (k % 2) * 7, groundY - bh + 5 + Math.floor(k / 2) * 8, 3, 4);
    }
  }

  // 본사 타워
  const tw = w * 0.22;
  const tx = w * 0.39;
  const th = h * 0.5 + dev * h * 0.32;
  ctx.fillStyle = '#2a3556';
  ctx.fillRect(tx, groundY - th, tw, th);
  ctx.fillStyle = '#8b6df0';
  ctx.fillRect(tx, groundY - th, tw, 4);
  const floors = Math.max(4, Math.round(th / 11));
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < 4; c++) {
      const lit = (Math.sin(t * 1.2 + f * 1.7 + c * 0.9) + 1) / 2 > 0.45;
      ctx.fillStyle = lit ? 'rgba(255,217,122,0.9)' : 'rgba(126,224,255,0.16)';
      ctx.fillRect(tx + 5 + c * (tw - 10) / 4, groundY - th + 9 + f * 11, (tw - 14) / 4, 5);
    }
  }
  // 옥상 항공장애등
  ctx.fillStyle = Math.sin(t * 3) > 0 ? '#f87171' : 'rgba(248,113,113,0.25)';
  ctx.beginPath();
  ctx.arc(tx + tw / 2, groundY - th - 4, 3, 0, 7);
  ctx.fill();

  void pingpong;
};

export const SITE_PAINTERS: Record<BusinessId, SitePainter> = {
  mine: mineSite,
  factory: factorySite,
  fishery: fisherySite,
  park: parkSite,
  corp: corpSite,
};
