import type { BuildingId } from '../../data/buildings';
import { BIZ_COLOR, FAC_COLOR, PAL, alpha, shade } from '../../data/palette';
import { TH, TW, box, car, cylinder, gableRoof, ground, project, pyramidRoof, shadow, windowsFront, worker, type Cam, type Ctx } from './iso';

export interface IsoArgs {
  ctx: Ctx;
  cam: Cam;
  /** 부지 좌상단 타일 */
  gx: number;
  gy: number;
  w: number;
  d: number;
  /** 외형 단계 0(빈 터) ~ 6 */
  tier: number;
  t: number;
  night: boolean;
  alert: boolean;
}

type Painter = (a: IsoArgs) => void;

const lit = (a: IsoArgs, seed: number) =>
  a.night ? (Math.sin(a.t * 0.6 + seed * 2.3) + 1) / 2 > 0.3 : (Math.sin(a.t * 0.4 + seed) + 1) / 2 > 0.75;

function emptyLot(a: IsoArgs): void {
  const { ctx, cam, gx, gy, w, d } = a;
  ground(ctx, cam, gx + 0.1, gy + 0.1, w - 0.2, d - 0.2, '#C4B191');
  // 울타리 말뚝
  for (let i = 0; i <= 4; i++) {
    const q = i / 4;
    box(ctx, cam, gx + q * (w - 0.12), gy + 0.02, 0.12, 0.12, 0.22, '#B08D57');
    box(ctx, cam, gx + 0.02, gy + q * (d - 0.12), 0.12, 0.12, 0.22, '#B08D57');
  }
}

function smoke(a: IsoArgs, gx: number, gy: number, z: number, n = 4): void {
  const { ctx, cam, t } = a;
  for (let i = 0; i < n; i++) {
    const q = (t * 0.3 + i * 0.25) % 1;
    const [x, y] = project(gx, gy, z + q * 1.6, cam);
    ctx.globalAlpha = (1 - q) * 0.42;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + Math.sin(q * 5 + i) * 6 * cam.zoom, y, (5 + q * 12) * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function tree(a: IsoArgs, gx: number, gy: number, s = 1): void {
  const { ctx, cam } = a;
  box(ctx, cam, gx - 0.05 * s, gy - 0.05 * s, 0.1 * s, 0.1 * s, 0.3 * s, '#8B6F47');
  const [x, y] = project(gx, gy, 0.3 * s, cam);
  ctx.fillStyle = shade('#5FAE58', 1.0);
  ctx.beginPath();
  ctx.ellipse(x, y - 8 * s * cam.zoom, 15 * s * cam.zoom, 12 * s * cam.zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade('#5FAE58', 0.8);
  ctx.beginPath();
  ctx.ellipse(x + 5 * s * cam.zoom, y - 4 * s * cam.zoom, 9 * s * cam.zoom, 7 * s * cam.zoom, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ─────────────────────────── 사업 ───────────────────────────

const mine: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#C9A97B');
  shadow(ctx, cam, gx + 0.2, gy + 0.2, w - 0.4, d - 0.4);

  // 갱도 입구
  box(ctx, cam, gx + 0.15, gy + 1.2, 0.7, 0.6, 0.5, '#8B6F47');
  gableRoof(ctx, cam, gx + 0.1, gy + 1.15, 0.8, 0.7, 0.5, 0.3, '#6E5638');
  ctx.fillStyle = '#3A2E22';
  const [ex, ey] = project(gx + 0.5, gy + 1.2, 0.02, cam);
  ctx.beginPath();
  ctx.ellipse(ex, ey - 8 * cam.zoom, 14 * cam.zoom, 12 * cam.zoom, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  if (tier >= 2) {
    // 권양탑
    const hx = gx + 1.25;
    const hy = gy + 0.55;
    const hh = 1.1 + tier * 0.22;
    box(ctx, cam, hx - 0.06, hy - 0.06, 0.12, 0.12, hh, '#9AA6B4');
    box(ctx, cam, hx + 0.3, hy + 0.3, 0.12, 0.12, hh * 0.72, '#9AA6B4');
    box(ctx, cam, hx - 0.1, hy - 0.1, 0.6, 0.6, 0.12, shade('#9AA6B4', 0.9), hh - 0.12);
    const [wx, wy] = project(hx, hy, hh + 0.18, cam);
    const r = 13 * cam.zoom;
    ctx.strokeStyle = PAL.accent;
    ctx.lineWidth = 3.2 * cam.zoom;
    ctx.beginPath();
    ctx.arc(wx, wy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2 * cam.zoom;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ang = t * 2 + (i / 3) * Math.PI * 2;
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(ang) * r, wy + Math.sin(ang) * r);
    }
    ctx.stroke();
  }
  if (tier >= 3) {
    box(ctx, cam, gx + 0.1, gy + 0.1, 0.75, 0.7, 0.55, PAL.wall);
    gableRoof(ctx, cam, gx + 0.05, gy + 0.05, 0.85, 0.8, 0.55, 0.25, BIZ_COLOR.mine);
    // 광석 더미
    const [px, py] = project(gx + 1.5, gy + 1.55, 0, cam);
    ctx.fillStyle = '#7E8B7A';
    ctx.beginPath();
    ctx.moveTo(px - 20 * cam.zoom, py);
    ctx.lineTo(px, py - 22 * cam.zoom);
    ctx.lineTo(px + 20 * cam.zoom, py);
    ctx.closePath();
    ctx.fill();
  }
  if (tier >= 5) {
    cylinder(ctx, cam, gx + 0.4, gy + 0.4, 0.13, 1.5, '#B7BFC8');
    smoke(a, gx + 0.4, gy + 0.4, 1.5, 3);
  }
  if (tier >= 4) car(ctx, cam, gx + 1.6, gy + 1.0, PAL.accent, true);
  worker(ctx, cam, gx + 0.75, gy + 1.75, PAL.accent, 0, 0.75, t * 0.7);
};

const factory: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#C8CCD2');
  shadow(ctx, cam, gx + 0.15, gy + 0.15, w - 0.3, d - 0.3);
  const bh = 0.55 + tier * 0.12;
  box(ctx, cam, gx + 0.12, gy + 0.12, w - 0.6, d - 0.5, bh, PAL.wall);
  // 톱니 지붕
  const teeth = 2 + Math.min(3, tier);
  for (let i = 0; i < teeth; i++) {
    const sw = (w - 0.6) / teeth;
    gableRoof(ctx, cam, gx + 0.12 + i * sw, gy + 0.12, sw, d - 0.5, bh, 0.22, BIZ_COLOR.factory);
  }
  windowsFront(ctx, cam, gx + 0.12, gy + d - 0.38, w - 0.6, 0.12, bh - 0.2, 3 + tier, 1, (r, c) => lit(a, r + c));
  // 굴뚝
  for (let i = 0; i < Math.max(1, tier - 1); i++) {
    const cx = gx + w - 0.32;
    const cy = gy + 0.35 + i * 0.4;
    cylinder(ctx, cam, cx, cy, 0.14, 0.9 + tier * 0.16, '#B7BFC8');
    smoke(a, cx, cy, 0.9 + tier * 0.16, 3);
  }
  if (tier >= 4) car(ctx, cam, gx + 0.6, gy + d - 0.12, BIZ_COLOR.factory, true);
};

const fishery: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, PAL.water);
  // 부두
  ground(ctx, cam, gx, gy, w, 0.9, '#C9A97B');
  box(ctx, cam, gx + 0.1, gy + 0.08, 0.9, 0.7, 0.5, PAL.wall);
  gableRoof(ctx, cam, gx + 0.05, gy + 0.03, 1.0, 0.8, 0.5, 0.28, BIZ_COLOR.fishery);
  // 배
  const boats = Math.min(4, tier);
  for (let i = 0; i < boats; i++) {
    const bx = gx + 0.25 + (i % 2) * 0.85;
    const by = gy + 1.1 + Math.floor(i / 2) * 0.55 + Math.sin(t * 1.6 + i) * 0.03;
    box(ctx, cam, bx, by, 0.6, 0.28, 0.14, PAL.wall);
    box(ctx, cam, bx + 0.34, by + 0.03, 0.2, 0.22, 0.3, BIZ_COLOR.fishery);
    const [mx, my] = project(bx + 0.1, by + 0.14, 0.14, cam);
    ctx.strokeStyle = '#8FA3B5';
    ctx.lineWidth = 2 * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx, my - 26 * cam.zoom);
    ctx.stroke();
  }
  // 물결
  ctx.strokeStyle = alpha('#FFFFFF', 0.35);
  ctx.lineWidth = 2 * cam.zoom;
  for (let r = 0; r < 2; r++) {
    ctx.beginPath();
    for (let s = 0; s <= 10; s++) {
      const q = s / 10;
      const [px, py] = project(gx + q * w, gy + 1.6 + r * 0.25 + Math.sin(q * 6 + t * 1.6) * 0.05, 0, cam);
      s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
};

const park: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#9AD07C');
  // 게이트
  box(ctx, cam, gx + 0.1, gy + d - 0.5, 0.16, 0.16, 0.7, BIZ_COLOR.park);
  box(ctx, cam, gx + 0.95, gy + d - 0.5, 0.16, 0.16, 0.7, BIZ_COLOR.park);
  box(ctx, cam, gx + 0.1, gy + d - 0.5, 1.01, 0.16, 0.14, shade(BIZ_COLOR.park, 1.1), 0.7);
  // 대관람차
  const r = (14 + tier * 4) * cam.zoom;
  const [cx, cy] = project(gx + 1.35, gy + 0.6, 0.7 + tier * 0.12, cam);
  ctx.strokeStyle = '#9AA6B4';
  ctx.lineWidth = 3 * cam.zoom;
  const [b1x, b1y] = project(gx + 1.15, gy + 0.6, 0, cam);
  const [b2x, b2y] = project(gx + 1.55, gy + 0.6, 0, cam);
  ctx.beginPath();
  ctx.moveTo(b1x, b1y);
  ctx.lineTo(cx, cy);
  ctx.lineTo(b2x, b2y);
  ctx.stroke();
  ctx.strokeStyle = PAL.accent;
  ctx.lineWidth = 2.6 * cam.zoom;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const spin = t * 0.7;
  const cabin = ['#E85D4A', '#4A90D9', '#FFC845', '#52B788'];
  for (let i = 0; i < 8; i++) {
    const ang = spin + (i / 8) * Math.PI * 2;
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang) * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = cabin[i % 4];
    ctx.beginPath();
    ctx.arc(px, py + 4 * cam.zoom, 4.6 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  // 텐트
  if (tier >= 2) {
    box(ctx, cam, gx + 0.15, gy + 0.9, 0.6, 0.6, 0.12, PAL.wall);
    pyramidRoof(ctx, cam, gx + 0.1, gy + 0.85, 0.7, 0.7, 0.12, 0.55, '#E85D4A');
  }
  if (tier >= 4) tree(a, gx + 1.8, gy + 1.7, 0.8);
};

const corp: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#C8CCD2');
  shadow(ctx, cam, gx + 0.3, gy + 0.3, w - 0.6, d - 0.6);
  const h = 0.8 + tier * 0.55;
  box(ctx, cam, gx + 0.35, gy + 0.35, w - 0.9, d - 0.9, h, PAL.wall);
  windowsFront(ctx, cam, gx + 0.35, gy + d - 0.55, w - 0.9, 0.15, h - 0.25, 3, Math.max(2, tier + 1), (r, c) => lit(a, r * 3 + c));
  box(ctx, cam, gx + 0.35, gy + 0.35, w - 0.9, d - 0.9, 0.08, BIZ_COLOR.corp, h);
  if (tier >= 4) {
    const [tx, ty] = project(gx + w / 2, gy + d / 2, h + 0.12, cam);
    ctx.fillStyle = Math.sin(a.t * 3) > 0 ? '#E85D4A' : alpha('#E85D4A', 0.25);
    ctx.beginPath();
    ctx.arc(tx, ty, 3.4 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
};

// ─────────────────────────── 시설 ───────────────────────────

const housing: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#B9D394');
  if (tier <= 2) {
    const n = tier === 1 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const bx = gx + 0.2 + i * 0.9;
      shadow(ctx, cam, bx, gy + 0.5, 0.75, 0.75);
      box(ctx, cam, bx, gy + 0.5, 0.75, 0.75, 0.5, FAC_COLOR.housing);
      gableRoof(ctx, cam, bx - 0.05, gy + 0.45, 0.85, 0.85, 0.5, 0.35, PAL.roof);
      windowsFront(ctx, cam, bx, gy + 1.25, 0.75, 0.14, 0.3, 2, 1, (_r, c) => lit(a, i * 3 + c));
    }
  } else {
    const n = tier >= 4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const bx = gx + 0.18 + i * ((w - 0.5) / n);
      const bw = (w - 0.5) / n - 0.08;
      const h = 0.9 + tier * 0.32 + (i % 2) * 0.2;
      shadow(ctx, cam, bx, gy + 0.5, bw, 0.75);
      box(ctx, cam, bx, gy + 0.5, bw, 0.75, h, FAC_COLOR.housing);
      box(ctx, cam, bx - 0.03, gy + 0.47, bw + 0.06, 0.81, 0.07, PAL.roof, h);
      windowsFront(ctx, cam, bx, gy + 1.25, bw, 0.15, h - 0.25, 2, Math.max(2, tier), (r, c) => lit(a, i * 5 + r * 2 + c));
    }
  }
};

const shops: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#D9CFC0');
  const h = 0.4 + tier * 0.22;
  shadow(ctx, cam, gx + 0.15, gy + 0.4, w - 0.3, d - 0.8);
  box(ctx, cam, gx + 0.15, gy + 0.4, w - 0.3, d - 0.8, h, PAL.wall);
  box(ctx, cam, gx + 0.1, gy + 0.35, w - 0.2, d - 0.7, 0.08, FAC_COLOR.shops, h);
  // 차양
  const stalls = 2 + Math.min(3, tier);
  for (let i = 0; i < stalls; i++) {
    const sw = (w - 0.3) / stalls;
    box(ctx, cam, gx + 0.15 + i * sw, gy + d - 0.42, sw - 0.04, 0.12, 0.06, i % 2 ? '#E85D4A' : PAL.accent, h * 0.55);
  }
  windowsFront(ctx, cam, gx + 0.15, gy + d - 0.4, w - 0.3, 0.1, h * 0.5, stalls, 1, () => true);
  if (tier >= 3) box(ctx, cam, gx + 0.5, gy + 0.3, w - 1.0, 0.1, 0.3, FAC_COLOR.shops, h);
};

const hospital: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#D6E4EE');
  const h = 0.55 + tier * 0.28;
  shadow(ctx, cam, gx + 0.25, gy + 0.3, w - 0.5, d - 0.7);
  box(ctx, cam, gx + 0.25, gy + 0.3, w - 0.5, d - 0.7, h, '#FFFFFF');
  box(ctx, cam, gx + 0.22, gy + 0.27, w - 0.44, d - 0.64, 0.07, '#DCE6EE', h);
  windowsFront(ctx, cam, gx + 0.25, gy + d - 0.4, w - 0.5, 0.14, h - 0.22, 3, Math.max(1, tier), (r, c) => lit(a, r + c));
  // 적십자
  const [cx, cy] = project(gx + w / 2, gy + d - 0.4, h * 0.72, cam);
  ctx.fillStyle = '#E85D4A';
  const s = 5 * cam.zoom;
  ctx.fillRect(cx - s / 3, cy - s, (s * 2) / 3, s * 2);
  ctx.fillRect(cx - s, cy - s / 3, s * 2, (s * 2) / 3);
};

const school: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#C7DFA8');
  const h = 0.5 + tier * 0.16;
  shadow(ctx, cam, gx + 0.2, gy + 0.3, w - 0.4, d - 0.8);
  box(ctx, cam, gx + 0.2, gy + 0.3, w - 0.4, d - 0.8, h, PAL.wall);
  gableRoof(ctx, cam, gx + 0.14, gy + 0.24, w - 0.28, d - 0.68, h, 0.24, FAC_COLOR.school);
  windowsFront(ctx, cam, gx + 0.2, gy + d - 0.5, w - 0.4, 0.14, h - 0.2, 4, Math.max(1, tier - 1), (rr, c) => lit(a, rr * 2 + c));
  if (tier >= 2) {
    box(ctx, cam, gx + w / 2 - 0.12, gy + 0.36, 0.24, 0.24, h + 0.5, PAL.wall);
    pyramidRoof(ctx, cam, gx + w / 2 - 0.16, gy + 0.32, 0.32, 0.32, h + 0.5, 0.3, FAC_COLOR.school);
    const [cx, cy] = project(gx + w / 2, gy + 0.6, h + 0.34, cam);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 5 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tier >= 3) tree(a, gx + 1.75, gy + 1.7, 0.7);
};

const fire: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t, alert } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#D8D2CC');
  const h = 0.5 + tier * 0.18;
  shadow(ctx, cam, gx + 0.2, gy + 0.35, w - 0.4, d - 0.75);
  box(ctx, cam, gx + 0.2, gy + 0.35, w - 0.4, d - 0.75, h, FAC_COLOR.fire);
  box(ctx, cam, gx + 0.16, gy + 0.31, w - 0.32, d - 0.67, 0.08, shade(FAC_COLOR.fire, 0.75), h);
  // 차고문
  const bays = Math.min(3, Math.max(1, tier - 1));
  for (let i = 0; i < bays; i++) {
    const bw = (w - 0.5) / bays;
    box(ctx, cam, gx + 0.25 + i * bw, gy + d - 0.42, bw - 0.08, 0.06, h * 0.62, '#3A3632');
  }
  if (tier >= 3) cylinder(ctx, cam, gx + w - 0.35, gy + 0.5, 0.1, h + 0.5, '#B7BFC8');
  if (alert) {
    const [sx, sy] = project(gx + w / 2, gy + 0.4, h + 0.15, cam);
    ctx.fillStyle = Math.sin(t * 12) > 0 ? '#E85D4A' : alpha('#E85D4A', 0.2);
    ctx.beginPath();
    ctx.arc(sx, sy, 5 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
};

const police: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#CFD6E2');
  const h = 0.5 + tier * 0.22;
  shadow(ctx, cam, gx + 0.2, gy + 0.35, w - 0.4, d - 0.75);
  box(ctx, cam, gx + 0.2, gy + 0.35, w - 0.4, d - 0.75, h, PAL.wall);
  box(ctx, cam, gx + 0.16, gy + 0.31, w - 0.32, d - 0.67, 0.08, FAC_COLOR.police, h);
  windowsFront(ctx, cam, gx + 0.2, gy + d - 0.4, w - 0.4, 0.14, h - 0.2, 3, Math.max(1, tier - 1), (r, c) => lit(a, r + c));
  const [lx, ly] = project(gx + w / 2, gy + 0.4, h + 0.14, cam);
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#4A90D9' : '#E85D4A';
  ctx.beginPath();
  ctx.arc(lx, ly, 4.2 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();
  if (tier >= 3) car(ctx, cam, gx + 1.6, gy + 1.6, '#4A90D9', true);
};

const green: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#7FBF6A');
  ground(ctx, cam, gx + 0.2, gy + 0.2, w - 0.4, d - 0.4, '#8FCB78');
  const n = 2 + tier;
  for (let i = 0; i < n; i++) {
    const q = i / n;
    tree(a, gx + 0.3 + (i % 3) * 0.6, gy + 0.35 + Math.floor(i / 3) * 0.6, 0.65 + q * 0.25);
  }
  if (tier >= 2) {
    const [fx, fy] = project(gx + w / 2, gy + d - 0.55, 0, cam);
    ctx.fillStyle = PAL.water;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 22 * cam.zoom, 11 * cam.zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alpha('#FFFFFF', 0.85);
    ctx.lineWidth = 2.4 * cam.zoom;
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.3;
      const hgt = (16 + Math.abs(Math.sin(t * 2 + i)) * 8) * cam.zoom;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 4 * cam.zoom);
      ctx.quadraticCurveTo(fx + Math.cos(ang) * hgt, fy - 4 * cam.zoom - hgt, fx + Math.cos(ang) * hgt * 2, fy);
      ctx.stroke();
    }
  }
};

const power: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, '#CFD2D6');
  shadow(ctx, cam, gx + 0.2, gy + 0.3, w - 0.4, d - 0.7);
  if (tier === 1) {
    box(ctx, cam, gx + 0.2, gy + 0.6, w - 0.5, d - 1.0, 0.6, PAL.wall);
    box(ctx, cam, gx + 0.16, gy + 0.56, w - 0.42, d - 0.92, 0.08, FAC_COLOR.power, 0.6);
    for (let i = 0; i < 2; i++) {
      cylinder(ctx, cam, gx + 0.45 + i * 0.55, gy + 0.35, 0.15, 1.5, '#D6DAE0');
      smoke(a, gx + 0.45 + i * 0.55, gy + 0.35, 1.5, 3);
    }
  } else if (tier === 2) {
    // 댐
    box(ctx, cam, gx + 0.1, gy + 0.7, w - 0.2, 0.35, 0.9, '#C6CBD2');
    ground(ctx, cam, gx + 0.1, gy + 0.1, w - 0.2, 0.6, PAL.water);
    for (let i = 0; i < 3; i++) box(ctx, cam, gx + 0.35 + i * 0.45, gy + 1.05, 0.22, 0.5, 0.06, PAL.water);
  } else if (tier === 3) {
    // 원자력 냉각탑
    for (let i = 0; i < 2; i++) {
      cylinder(ctx, cam, gx + 0.6 + i * 0.8, gy + 0.7, 0.32, 1.2, '#DDE2E8');
      smoke(a, gx + 0.6 + i * 0.8, gy + 0.7, 1.2, 4);
    }
    box(ctx, cam, gx + 0.2, gy + 1.45, w - 0.5, 0.4, 0.4, PAL.wall);
  } else {
    // 신재생
    for (let i = 0; i < 4; i++) {
      const px = gx + 0.3 + (i % 2) * 0.7;
      const py = gy + 0.4 + Math.floor(i / 2) * 0.6;
      box(ctx, cam, px, py, 0.5, 0.3, 0.06, '#2F5F9E', 0.16);
      box(ctx, cam, px + 0.22, py + 0.12, 0.06, 0.06, 0.16, '#9AA6B4');
    }
    const [wx, wy] = project(gx + 1.6, gy + 1.5, 1.5, cam);
    box(ctx, cam, gx + 1.56, gy + 1.46, 0.08, 0.08, 1.5, PAL.wall);
    ctx.strokeStyle = PAL.wall;
    ctx.lineWidth = 3 * cam.zoom;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ang = t * 2 + (i / 3) * Math.PI * 2;
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(ang) * 20 * cam.zoom, wy + Math.sin(ang) * 20 * cam.zoom);
    }
    ctx.stroke();
  }
  // 송전탑
  if (tier >= 2) {
    box(ctx, cam, gx + w - 0.3, gy + d - 0.4, 0.08, 0.08, 1.1, '#9AA6B4');
    box(ctx, cam, gx + w - 0.45, gy + d - 0.42, 0.38, 0.06, 0.06, '#9AA6B4', 0.85);
  }
};

const road: Painter = (a) => {
  const { ctx, cam, gx, gy, w, d, tier, t } = a;
  if (tier === 0) return emptyLot(a);
  ground(ctx, cam, gx, gy, w, d, PAL.road);
  box(ctx, cam, gx + 0.45, gy + 0.5, w - 1.1, d - 1.1, 0.55, PAL.wall);
  box(ctx, cam, gx + 0.4, gy + 0.45, w - 1.0, d - 1.0, 0.08, FAC_COLOR.road, 0.55);
  windowsFront(ctx, cam, gx + 0.45, gy + d - 0.6, w - 1.1, 0.14, 0.3, 3, 1, () => true);
  // 신호등
  const sx = gx + w - 0.35;
  const sy = gy + d - 0.35;
  box(ctx, cam, sx, sy, 0.07, 0.07, 0.7, '#5A6470');
  const [tx, ty] = project(sx + 0.035, sy + 0.035, 0.95, cam);
  const phase = Math.floor(t * 0.7) % 3;
  const cols = ['#E85D4A', PAL.accent, '#52B788'];
  ctx.fillStyle = alpha('#2A2E33', 0.9);
  ctx.beginPath();
  ctx.ellipse(tx, ty, 6 * cam.zoom, 10 * cam.zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = phase === i ? cols[i] : alpha('#FFFFFF', 0.12);
    ctx.beginPath();
    ctx.arc(tx, ty - 5 * cam.zoom + i * 5 * cam.zoom, 2.2 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tier >= 3) car(ctx, cam, gx + 0.6, gy + 1.75, '#E85D4A', true);
};

export const ISO_BUILDINGS: Record<BuildingId, Painter> = {
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

export { TW, TH };
