import { BUSINESSES } from '../data/businesses';
import {
  FACILITY_BY_ID,
  FACILITY_IDS,
  LOTS,
  WORLD,
  isFacilityId,
  tierOf,
  type BuildingId,
} from '../data/buildings';
import { CONFIG } from '../data/config';
import { chainActive, isUnlocked, projectedEfficiency, stats } from '../core/economy';
import { facilityTier, isBuilt, facilityUnlocked, buildPrice, canAfford } from '../core/facilities';
import { activeEvent } from '../core/events';
import { clamp } from '../core/num';
import type { Game } from '../core/game';
import type { BusinessId, GameState } from '../core/types';
import { h } from './dom';
import { fitCanvas, seeded, vGradient } from './scene/gfx';
import { TOWN_PAINTERS, drawCars, drawCitizens, drawFireTruck } from './scene/townBuildings';

export interface MapView {
  root: HTMLElement;
  update: () => void;
  draw: (t: number) => void;
  focus: (id: BuildingId) => void;
}

export interface BuildingAlert {
  icon: string;
  text: string;
  tone: 'bad' | 'warn' | 'good';
}

/** 건물 외형 단계 */
export function buildingTier(state: GameState, id: BuildingId): number {
  if (isFacilityId(id)) return facilityTier(state, id);
  const def = BUSINESSES.find((b) => b.id === id)!;
  if (!isUnlocked(state, def)) return 0;
  const sum = state.businesses[id as BusinessId].units.reduce((a, u) => a + u.level, 0);
  return Math.max(1, tierOf(sum));
}

/** ⚠️ 표시 — 기획서 8장 병목 표시 */
export function buildingAlert(state: GameState, id: BuildingId, now = Date.now()): BuildingAlert | null {
  const ev = activeEvent(state, id, now);
  if (ev) {
    return ev.kind === 'fire'
      ? { icon: '🔥', text: '화재 발생 — 소방차 출동 중', tone: 'bad' }
      : { icon: '🚨', text: '도난 발생', tone: 'bad' };
  }
  const cs = stats(state);
  if (isFacilityId(id)) {
    if (!isBuilt(state, id)) {
      if (facilityUnlocked(state, id)) {
        const affordable = canAfford(state, buildPrice(id));
        return affordable
          ? { icon: '🔨', text: '지을 수 있습니다', tone: 'good' }
          : { icon: '＋', text: '건설 가능 (자원 부족)', tone: 'warn' };
      }
      return null;
    }
    if (id === 'power' && cs.powerEff < 0.999) {
      return { icon: '⚡', text: `전력 부족 — 전 사업 ${Math.round(cs.powerEff * 100)}%`, tone: 'bad' };
    }
    if (id === 'housing' && cs.laborEff < 0.999) {
      return { icon: '🧑', text: `노동력 부족 — 전 사업 ${Math.round(cs.laborEff * 100)}%`, tone: 'bad' };
    }
    return null;
  }
  const def = BUSINESSES.find((b) => b.id === id)!;
  if (!isUnlocked(state, def)) return null;
  const bs = state.businesses[id as BusinessId];
  if (bs.units.every((u) => u.level <= 0)) return { icon: '＋', text: '아직 아무것도 없습니다', tone: 'warn' };
  if (def.input && chainActive(state)) {
    const eff = projectedEfficiency(state, def, now);
    if (eff < 0.9) {
      const RES: Record<string, string> = { ore: '원석', goods: '제품', food: '식재료', pop: '관광객' };
      const label = RES[def.input.resource] ?? '자원';
      return { icon: '⚠️', text: `${label} 부족 — 가동률 ${Math.round(eff * 100)}%`, tone: 'warn' };
    }
  }
  if (bs.units.some((u) => u.level > 0 && !u.manager && !u.equip)) {
    return { icon: '👷', text: '자동화 안 된 설비가 있습니다', tone: 'warn' };
  }
  return null;
}

const ALL_IDS: BuildingId[] = [...BUSINESSES.map((b) => b.id), ...FACILITY_IDS];

function buildingName(id: BuildingId): string {
  if (isFacilityId(id)) return FACILITY_BY_ID[id].name;
  return BUSINESSES.find((b) => b.id === id)!.name;
}

function buildingUnlocked(state: GameState, id: BuildingId): boolean {
  if (isFacilityId(id)) return facilityUnlocked(state, id);
  return isUnlocked(state, BUSINESSES.find((b) => b.id === id)!);
}

function unlockLevel(id: BuildingId): number {
  return isFacilityId(id)
    ? FACILITY_BY_ID[id].unlockCityLevel
    : BUSINESSES.find((b) => b.id === id)!.unlockCityLevel;
}

/** 도시 지형 단계 — 들판 → 마을 → 소도시 → 도시 → 대도시 */
export function terrainStage(level: number): number {
  if (level >= 26) return 4;
  if (level >= 18) return 3;
  if (level >= 11) return 2;
  if (level >= 5) return 1;
  return 0;
}

const TERRAIN_NAMES = ['들판', '마을', '소도시', '도시', '대도시'];
export const terrainName = (level: number) => TERRAIN_NAMES[terrainStage(level)];

const SKY_DAY: [string, string][] = [
  ['#6ea8d8', '#bcd9ee'],
  ['#5f9ad0', '#b2d3ea'],
  ['#5590c8', '#a9cde6'],
  ['#4a83bd', '#9dc4e0'],
  ['#3f76b2', '#93bcd9'],
];
const SKY_NIGHT: [string, string][] = [
  ['#16233c', '#3b5170'],
  ['#141f36', '#38496a'],
  ['#111a30', '#332f5e'],
  ['#0d1428', '#2c2154'],
  ['#0a0f20', '#241848'],
];

export function createCityMap(game: Game, onEnter: (id: BuildingId) => void): MapView {
  const canvas = h('canvas', { class: 'map-art' });
  const root = h('div', { class: 'map' }, canvas);

  let zoom = 1;
  let camX = 0;
  let camY = 0;
  let started = false;

  // ── 입력 (드래그 / 핀치 / 탭) ──
  const pointers = new Map<number, { x: number; y: number }>();
  let dragging = false;
  let moved = 0;
  let downAt = 0;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 0;
  let pinchZoom = 1;

  const viewW = () => root.clientWidth || 360;
  const viewH = () => root.clientHeight || 400;

  /** 하단 UI(빠른 액션 + 메뉴바)가 가리는 높이 */
  const UI_BOTTOM = 132;

  /** 도시 전체가 UI 위 영역에 들어오는 배율 */
  function minZoom(): number {
    return Math.min(viewW() / WORLD.w, (viewH() - UI_BOTTOM) / WORLD.h);
  }

  function clampCam(): void {
    const vw = viewW() / zoom;
    const vh = viewH() / zoom;
    if (WORLD.w <= vw) camX = (WORLD.w - vw) / 2;
    else camX = clamp(camX, 0, WORLD.w - vw);

    const usable = (viewH() - UI_BOTTOM) / zoom;
    if (WORLD.h <= usable) camY = (WORLD.h - usable) / 2;
    else camY = clamp(camY, 0, WORLD.h - vh + UI_BOTTOM / zoom);
  }

  function toWorld(sx: number, sy: number): [number, number] {
    return [camX + sx / zoom, camY + sy / zoom];
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      moved = 0;
      downAt = performance.now();
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = zoom;
      dragging = false;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) {
        zoom = clamp((pinchZoom * d) / pinchDist, minZoom(), 2.4);
        clampCam();
      }
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    camX -= dx / zoom;
    camY -= dy / zoom;
    clampCam();
  });

  function endPointer(e: PointerEvent): void {
    if (pointers.size === 1 && dragging && moved < 10 && performance.now() - downAt < 500) {
      const r = canvas.getBoundingClientRect();
      const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      const hit = hitTest(wx, wy);
      if (hit) onEnter(hit);
    }
    pointers.delete(e.pointerId);
    if (pointers.size === 0) dragging = false;
    if (pointers.size < 2) pinchDist = 0;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom = clamp(zoom * (e.deltaY < 0 ? 1.12 : 0.89), minZoom(), 2.4);
      clampCam();
    },
    { passive: false },
  );

  function rowY(row: number): number {
    return WORLD.rows[row] ?? WORLD.rows[WORLD.rows.length - 1];
  }

  function lotRect(id: BuildingId): { x0: number; y0: number; x1: number; y1: number; baseY: number; w: number } {
    const lot = LOTS[id];
    const baseY = rowY(lot.row);
    return {
      x0: lot.x - lot.w * 0.55,
      x1: lot.x + lot.w * 0.55,
      y0: baseY - lot.w * 0.95,
      y1: baseY + 26,
      baseY,
      w: lot.w,
    };
  }

  function hitTest(wx: number, wy: number): BuildingId | null {
    // 아래 행이 위에 그려지므로 아래 행부터 검사
    const order = [...ALL_IDS].sort((a, b) => LOTS[b].row - LOTS[a].row);
    for (const id of order) {
      const r = lotRect(id);
      if (wx >= r.x0 && wx <= r.x1 && wy >= r.y0 && wy <= r.y1) return id;
    }
    return null;
  }

  function focus(id: BuildingId): void {
    const lot = LOTS[id];
    camX = lot.x - viewW() / zoom / 2;
    camY = rowY(lot.row) - (viewH() / zoom) * 0.62;
    clampCam();
  }

  // ── 그리기 ──
  function draw(t: number): void {
    const vw = viewW();
    const vh = viewH();
    if (vw <= 0 || vh <= 0) return;
    const ctx = fitCanvas(canvas, vw, vh);
    const st = game.state;
    const now = Date.now();
    const hour = new Date(now).getHours();
    const night = hour >= 19 || hour < 6;
    const stage = terrainStage(st.city.level);

    if (!started) {
      started = true;
      zoom = minZoom();
      camX = 0;
      camY = 0;
      clampCam();
    }
    zoom = Math.max(zoom, minZoom());
    clampCam();

    // 하늘 (화면 좌표)
    const [c0, c1] = (night ? SKY_NIGHT : SKY_DAY)[stage];
    ctx.fillStyle = vGradient(ctx, 0, vh, c0, c1);
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    const rand = seeded(31337);

    // 지면 (도시 전체 부지)
    const groundBase = stage === 0 ? '#4f7a45' : stage === 1 ? '#4a6b41' : stage === 2 ? '#3d5344' : '#2f3a4d';
    ctx.fillStyle = groundBase;
    ctx.fillRect(-200, 0, WORLD.w + 400, WORLD.h + 200);

    // 위쪽 산 / 원경
    ctx.fillStyle = night ? 'rgba(10,16,30,0.75)' : 'rgba(58,84,112,0.6)';
    ctx.beginPath();
    ctx.moveTo(-200, WORLD.rows[0] - 90);
    for (let x = -200; x <= WORLD.w + 200; x += 190) {
      ctx.lineTo(x + 95, WORLD.rows[0] - 90 - 80 - seeded(x + 7)() * 120);
      ctx.lineTo(x + 190, WORLD.rows[0] - 90 - 30);
    }
    ctx.lineTo(WORLD.w + 200, WORLD.rows[0] - 90);
    ctx.fill();
    // 별 / 해·달 (원경 위)
    if (night) {
      for (let i = 0; i < 60; i++) {
        const x = -100 + rand() * (WORLD.w + 200);
        const y = rand() * (WORLD.rows[0] - 180);
        ctx.globalAlpha = 0.3 + 0.6 * ((Math.sin(t * 1.3 + i) + 1) / 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, 2.4, 2.4);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f4f1e0';
      ctx.beginPath();
      ctx.arc(WORLD.w * 0.78, 90, 30, 0, 7);
      ctx.fill();
      ctx.fillStyle = c0;
      ctx.beginPath();
      ctx.arc(WORLD.w * 0.78 - 12, 80, 30, 0, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,229,150,0.95)';
      ctx.beginPath();
      ctx.arc(WORLD.w * 0.78, 96, 38, 0, 7);
      ctx.fill();
    }
    // 구름
    for (let i = 0; i < 4; i++) {
      const base = rand();
      const cx = ((t * (5 + base * 7) + base * WORLD.w) % (WORLD.w + 400)) - 200;
      const cy = 50 + base * 130;
      ctx.globalAlpha = night ? 0.1 : 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, 7);
      ctx.arc(cx + 36, cy + 8, 25, 0, 7);
      ctx.arc(cx - 32, cy + 9, 21, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 원경 건물 (도시가 커지면 배경도 채워진다)
    if (stage >= 2) {
      const bg = seeded(555);
      const n = 10 + stage * 10;
      for (let i = 0; i < n; i++) {
        const bx = -100 + bg() * (WORLD.w + 200);
        const bw = 26 + bg() * 40;
        const bh = 50 + bg() * (50 + stage * 50);
        ctx.fillStyle = night ? 'rgba(14,20,38,0.9)' : 'rgba(90,115,145,0.5)';
        ctx.fillRect(bx, WORLD.rows[0] - 100 - bh, bw, bh);
        if (night) {
          for (let k = 0; k < 6; k++) {
            if (bg() > 0.5) continue;
            ctx.fillStyle = 'rgba(255,217,122,0.6)';
            ctx.fillRect(bx + 5 + (k % 2) * 12, WORLD.rows[0] - 96 - bh + 9 + Math.floor(k / 2) * 14, 5, 6);
          }
        }
      }
    }

    // 바다 (마지막 행 아래 — 항구)
    const seaY = WORLD.rows[WORLD.rows.length - 1] + 26;
    ctx.fillStyle = night ? '#082033' : '#12496b';
    ctx.fillRect(-200, seaY, WORLD.w + 400, WORLD.h - seaY + 200);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      for (let x = -200; x <= WORLD.w + 200; x += 10) {
        const y = seaY + 18 + r * 22 + Math.sin(x / 34 + t * (1.1 + r * 0.3)) * 4;
        x === -200 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 행별 인도 + 도로
    const roadTier = buildingTier(st, 'road');
    const roadH = 36 + roadTier * 5;
    const roads: number[] = [];
    for (let i = 0; i < WORLD.rows.length; i++) {
      const base = WORLD.rows[i];
      if (i === WORLD.rows.length - 1) continue; // 마지막 행 아래는 바다
      const sy = base + 12;
      ctx.fillStyle = '#7d8698';
      ctx.fillRect(-200, sy, WORLD.w + 400, 9);
      const ry = sy + 9;
      roads.push(ry);
      ctx.fillStyle = roadTier === 0 ? '#6b5a42' : '#252c3b';
      ctx.fillRect(-200, ry, WORLD.w + 400, roadH);
      if (roadTier > 0) {
        ctx.fillStyle = 'rgba(160,180,215,0.55)';
        const dash = 44;
        const off = (t * 44) % dash;
        for (let x = -200 - off; x < WORLD.w + 200; x += dash) ctx.fillRect(x, ry + roadH / 2 - 2, 22, 3.5);
      }
      ctx.fillStyle = '#7d8698';
      ctx.fillRect(-200, ry + roadH, WORLD.w + 400, 9);
      // 가로등
      if (roadTier >= 2) {
        for (let x = 60; x < WORLD.w; x += 250) {
          ctx.strokeStyle = '#6b7692';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x, ry);
          ctx.lineTo(x, ry - 44);
          ctx.lineTo(x + 16, ry - 48);
          ctx.stroke();
          if (night) {
            const g = ctx.createRadialGradient(x + 16, ry - 46, 2, x + 16, ry - 46, 80);
            g.addColorStop(0, 'rgba(255,214,130,0.42)');
            g.addColorStop(1, 'rgba(255,214,130,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x + 16, ry - 46, 80, 0, 7);
            ctx.fill();
          }
        }
      }
    }
    // 세로 연결 도로
    ctx.fillStyle = roadTier === 0 ? '#6b5a42' : '#252c3b';
    ctx.fillRect(WORLD.w * 0.5 - 22, WORLD.rows[0], 44, seaY - WORLD.rows[0]);

    // 건물 (위 행부터)
    for (let row = 0; row < WORLD.rows.length; row++) {
      for (const id of ALL_IDS) {
        const lot = LOTS[id];
        if (lot.row !== row) continue;
        const r = lotRect(id);
        const sy0 = (r.y0 - camY) * zoom;
        const sy1 = (r.y1 - camY) * zoom;
        if (sy1 < -120 || sy0 > vh + 120) continue;

        const tier = buildingTier(st, id);
        if (tier > (st.collection.seenTiers[id] ?? 0)) st.collection.seenTiers[id] = tier;
        const unlocked = buildingUnlocked(st, id);
        const alert = buildingAlert(st, id, now);

        // 부지 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(lot.x, r.baseY + 4, lot.w * 0.46, 10, 0, 0, 7);
        ctx.fill();

        ctx.save();
        if (!unlocked) ctx.globalAlpha = 0.4;
        TOWN_PAINTERS[id]({
          ctx,
          x: lot.x,
          baseY: r.baseY,
          w: lot.w,
          tier,
          t,
          night,
          alert: alert?.tone === 'bad',
        });
        ctx.restore();

        // 이름표
        const labelY = r.baseY + 22;
        ctx.font = `700 15px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const label = unlocked ? buildingName(id) : `🔒 Lv.${unlockLevel(id)}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(6,10,20,0.66)';
        ctx.beginPath();
        ctx.roundRect(lot.x - tw / 2 - 10, labelY - 14, tw + 20, 21, 10);
        ctx.fill();
        ctx.fillStyle = unlocked ? '#eaf1ff' : '#9db0cf';
        ctx.fillText(label, lot.x, labelY + 2);
        ctx.textAlign = 'left';

        // ⚠️ 마커
        if (alert && unlocked) {
          const my = r.baseY - lot.w * 0.66 - 10 + Math.sin(t * 3) * 4;
          ctx.font = '22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle =
            alert.tone === 'bad' ? 'rgba(248,113,113,0.96)' : alert.tone === 'warn' ? 'rgba(251,146,60,0.96)' : 'rgba(74,222,128,0.96)';
          ctx.beginPath();
          ctx.arc(lot.x, my, 17, 0, 7);
          ctx.fill();
          ctx.fillStyle = '#0b111c';
          ctx.fillText(alert.icon, lot.x, my + 8);
          ctx.textAlign = 'left';
        }
      }

      // 이 행 도로의 차량 / 시민
      const ry = roads[row];
      if (ry !== undefined) {
        const cars = roadTier === 0 ? 1 : 1 + roadTier;
        drawCars(ctx, 0, WORLD.w, ry + roadH / 2 - 6, cars, t + row * 3, night, 1);
        const pop = st.city.pop;
        const citizens = clamp(Math.round(1 + Math.log10(1 + pop) * 1.4), 1, 7);
        drawCitizens(ctx, 0, WORLD.w, WORLD.rows[row] + 22, citizens, t + row * 5, 1);
      }
    }

    // 소방차 출동
    for (const ev of st.events) {
      if (ev.kind !== 'fire' || ev.until <= now) continue;
      const lot = LOTS[ev.target as BuildingId];
      if (!lot) continue;
      const q = clamp(1 - (ev.until - now) / (CONFIG.events.fireSeconds * 1000), 0, 1);
      const from = LOTS.fire;
      const tx = from.x + (lot.x - from.x) * Math.min(1, q * 3);
      const ty = rowY(from.row) + (rowY(lot.row) - rowY(from.row)) * Math.min(1, q * 3);
      drawFireTruck(ctx, tx - 17, ty + 30, t, 1);
    }

    ctx.restore();
  }

  function update(): void {
    /* 지도는 draw 에서 상태를 직접 읽는다 */
  }

  return { root, update, draw, focus };
}
