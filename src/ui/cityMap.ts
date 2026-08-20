import { BUSINESSES } from '../data/businesses';
import {
  FACILITY_BY_ID,
  FACILITY_IDS,
  GRID,
  LOTS,
  businessTierOf,
  facilityTierOf,
  isFacilityId,
  isRoadTile,
  isWaterTile,
  terrainStage,
  type BuildingId,
} from '../data/buildings';
import { CONFIG } from '../data/config';
import { alpha, shade } from '../data/palette';
import { chainActive, isUnlocked, projectedEfficiency, staffed, stats } from '../core/economy';
import { facilityCost, facilityLevel, facilityUnlocked, isBuilt } from '../core/facilities';
import { activeEvent } from '../core/events';
import { clamp } from '../core/num';
import type { Game } from '../core/game';
import type { BusinessId, GameState } from '../core/types';
import { h } from './dom';
import { TH, TW, fit, project, type Cam } from './scene/iso';
import { drawSprite, drawTileSprite, hasSprite, placeholder } from './art/assets';
import { buildingKeysFor, tileKeysFor } from './art/keys';
import { bizName, currentEra, eraPalette, facName, settlementName } from '../core/era';

/** 도시 규모 이름은 시대마다 다르다 (석기 '큰 부족' ~ 우주 '성간 도시') */
export const terrainName = (state: GameState) => settlementName(state);

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

export function buildingTier(state: GameState, id: BuildingId): number {
  if (isFacilityId(id)) return facilityTierOf(facilityLevel(state, id));
  const def = BUSINESSES.find((b) => b.id === id)!;
  if (!isUnlocked(state, def)) return 0;
  const sum = state.businesses[id as BusinessId].units.reduce((a, u) => a + u.level, 0);
  return businessTierOf(sum);
}

const RES_LABEL: Record<string, string> = { ore: '원석', goods: '제품', food: '식재료', pop: '관광객' };

export function buildingAlert(state: GameState, id: BuildingId, now = Date.now()): BuildingAlert | null {
  const ev = activeEvent(state, id, now);
  if (ev) {
    return ev.kind === 'fire'
      ? { icon: '🔥', text: '화재 — 소방차 출동 중', tone: 'bad' }
      : { icon: '🚨', text: '도난 발생', tone: 'bad' };
  }
  const cs = stats(state);
  if (isFacilityId(id)) {
    if (!facilityUnlocked(state, id)) return null;
    if (!isBuilt(state, id)) {
      return state.resources.cash >= facilityCost(state, id)
        ? { icon: '🔨', text: '지을 수 있습니다', tone: 'good' }
        : { icon: '＋', text: '건설 가능 (자금 부족)', tone: 'warn' };
    }
    if (id === 'power' && cs.powerEff < 0.999) {
      return { icon: '⚡', text: `전력 부족 — 산출 ${Math.round(cs.powerEff * 100)}%`, tone: 'bad' };
    }
    if (id === 'housing' && cs.laborSupply < cs.popDemand) {
      return { icon: '🧑', text: '인구 부족 — 멈춘 유닛이 있습니다', tone: 'bad' };
    }
    return null;
  }
  const def = BUSINESSES.find((b) => b.id === id)!;
  if (!isUnlocked(state, def)) return null;
  const bs = state.businesses[id as BusinessId];
  if (bs.units.every((u) => !u.unlocked)) return { icon: '＋', text: '아직 아무것도 없습니다', tone: 'warn' };
  const owned = bs.units.filter((u) => u.unlocked).length;
  if (staffed(state, id as BusinessId) < owned) {
    return { icon: '🧑', text: '인구가 모자라 멈춘 유닛이 있습니다', tone: 'bad' };
  }
  if (def.input && chainActive(state)) {
    const eff = projectedEfficiency(state, def, now);
    if (eff < 0.9) {
      return {
        icon: '⚠️',
        text: `${RES_LABEL[def.input.resource] ?? '자원'} 부족 — 가동률 ${Math.round(eff * 100)}%`,
        tone: 'warn',
      };
    }
  }
  if (bs.units.some((u) => u.unlocked && !u.manager && !u.equip)) {
    return { icon: '👷', text: '자동화 안 된 설비가 있습니다', tone: 'warn' };
  }
  return null;
}

const ALL_IDS: BuildingId[] = [...BUSINESSES.map((b) => b.id), ...FACILITY_IDS];

function buildingName(state: GameState, id: BuildingId): string {
  return isFacilityId(id) ? facName(state, id) : bizName(state, id as BusinessId);
}
function buildingUnlocked(state: GameState, id: BuildingId): boolean {
  return isFacilityId(id)
    ? facilityUnlocked(state, id)
    : isUnlocked(state, BUSINESSES.find((b) => b.id === id)!);
}
function unlockLevel(id: BuildingId): number {
  return isFacilityId(id)
    ? FACILITY_BY_ID[id].unlockCityLevel
    : BUSINESSES.find((b) => b.id === id)!.unlockCityLevel;
}

/** 지형 단계별 지면색 — 시대 팔레트의 ground 를 단계마다 조금씩 눌러 쓴다 */
function grassOf(state: GameState, stage: number): string {
  return shade(eraPalette(state).ground, 1 - stage * 0.035);
}

export function createCityMap(game: Game, onEnter: (id: BuildingId) => void): MapView {
  const canvas = h('canvas', { class: 'map-art' });
  const root = h('div', { class: 'map' }, canvas);

  const cam: Cam = { x: 0, y: 0, zoom: 1, w: 1, h: 1 };
  let started = false;
  const hitRects = new Map<BuildingId, [number, number, number, number]>();

  const pointers = new Map<number, { x: number; y: number }>();
  let dragging = false;
  let moved = 0;
  let downAt = 0;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 0;
  let pinchZoom = 1;

  const viewW = () => root.clientWidth || 360;
  const viewH = () => root.clientHeight || 500;
  const UI_BOTTOM = 132;

  function bounds() {
    const xs = [
      (0 - GRID.rows) * (TW / 2),
      (GRID.cols - 0) * (TW / 2),
    ];
    return {
      minX: xs[0],
      maxX: xs[1],
      minY: -60,
      maxY: (GRID.cols + GRID.rows) * (TH / 2) + 40,
    };
  }

  /** 도시 전체가 가로로 들어오는 배율 */
  function fitZoom(): number {
    const b = bounds();
    return viewW() / (b.maxX - b.minX);
  }
  function minZoom(): number {
    return fitZoom() * 0.85;
  }

  function clampCam(): void {
    const b = bounds();
    const halfW = viewW() / 2 / cam.zoom;
    const halfH = (viewH() - UI_BOTTOM) / 2 / cam.zoom;
    const cw = b.maxX - b.minX;
    const ch = b.maxY - b.minY;
    cam.x = cw * cam.zoom <= viewW() ? (b.minX + b.maxX) / 2 : clamp(cam.x, b.minX + halfW, b.maxX - halfW);
    const cy0 = b.minY + halfH - UI_BOTTOM / 2 / cam.zoom;
    const cy1 = b.maxY - halfH + UI_BOTTOM / 2 / cam.zoom;
    cam.y = ch * cam.zoom <= viewH() - UI_BOTTOM ? (b.minY + b.maxY) / 2 + UI_BOTTOM / 2 / cam.zoom : clamp(cam.y, Math.min(cy0, cy1), Math.max(cy0, cy1));
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
      pinchZoom = cam.zoom;
      dragging = false;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) {
        cam.zoom = clamp((pinchZoom * dist) / pinchDist, minZoom(), 2.6);
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
    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;
    clampCam();
  });

  function endPointer(e: PointerEvent): void {
    if (pointers.size === 1 && dragging && moved < 10 && performance.now() - downAt < 500) {
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      // 앞쪽(아래) 건물부터 검사
      const order = [...ALL_IDS].sort((a, b) => LOTS[b].gx + LOTS[b].gy - (LOTS[a].gx + LOTS[a].gy));
      for (const id of order) {
        const rect = hitRects.get(id);
        if (!rect) continue;
        if (px >= rect[0] && px <= rect[2] && py >= rect[1] && py <= rect[3]) {
          onEnter(id);
          break;
        }
      }
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
      cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 0.89), minZoom(), 2.6);
      clampCam();
    },
    { passive: false },
  );

  function focus(id: BuildingId): void {
    const lot = LOTS[id];
    const sx = (lot.gx + 1 - (lot.gy + 1)) * (TW / 2);
    const sy = (lot.gx + 1 + lot.gy + 1) * (TH / 2);
    cam.x = sx;
    cam.y = sy;
    clampCam();
  }

  function draw(t: number): void {
    const vw = viewW();
    const vh = viewH();
    if (vw <= 0 || vh <= 0) return;
    const ctx = fit(canvas, vw, vh);
    cam.w = vw;
    cam.h = vh;
    const st = game.state;
    const now = Date.now();
    const hour = new Date(now).getHours();
    const night = hour >= 19 || hour < 6;
    const stage = terrainStage(st.city.level);

    if (!started) {
      started = true;
      cam.zoom = fitZoom() * 0.95;
      clampCam();
    }
    cam.zoom = Math.max(cam.zoom, minZoom());
    clampCam();

    // 하늘
    const pal = eraPalette(st);
    const eraId = currentEra(st).id;
    const skyTop = night ? shade(pal.skyTop, 0.5) : pal.skyTop;
    const skyBot = night ? shade(pal.sky, 0.62) : pal.sky;
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, skyTop);
    g.addColorStop(1, skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // 주변 들판 (도시 밖까지 채워 화면이 비지 않게)
    const OUT = 12;
    const grassOut = night ? shade(grassOf(st, stage), 0.66) : shade(grassOf(st, stage), 0.94);
    for (let gy = -OUT; gy < GRID.rows + OUT; gy++) {
      for (let gx = -OUT; gx < GRID.cols + OUT; gx++) {
        if (gx >= 0 && gx < GRID.cols && gy >= 0 && gy < GRID.rows) continue;
        const water = gy >= GRID.rows - 1;
        const wob = water ? Math.sin(gx * 0.7 + gy * 0.5 + t * 1.2) * 0.5 + 0.5 : 0;
        const col = water
          ? shade(night ? shade(pal.water, 0.6) : pal.water, 0.93 + wob * 0.1)
          : shade(grassOut, (gx + gy) % 2 === 0 ? 1 : 0.97);
        tileAt(ctx, eraId, gx, gy, col, water ? 'ground/water' : 'ground/grass');
      }
    }
    // 바깥 나무
    for (let i = 0; i < 26; i++) {
      const seed = i * 2654435761;
      const rx = ((seed >>> 8) % 1000) / 1000;
      const ry = ((seed >>> 16) % 1000) / 1000;
      const gx = -OUT + rx * (GRID.cols + OUT * 2);
      const gy = -OUT + ry * (GRID.rows - 1 + OUT);
      if (gx > -1.5 && gx < GRID.cols + 0.5 && gy > -1.5 && gy < GRID.rows + 0.5) continue;
      drawAny(ctx, tileKeysFor(eraId, 'props/tree'), gx - 0.5, gy - 0.5, 1, 1);
    }

    // 도시 부지 타일
    const grass = night ? shade(grassOf(st, stage), 0.72) : grassOf(st, stage);
    const roadCol = night ? shade(pal.road, 0.68) : pal.road;
    const roadTier = buildingTier(st, 'road');
    for (let gy = 0; gy < GRID.rows; gy++) {
      for (let gx = 0; gx < GRID.cols; gx++) {
        if (isWaterTile(gx, gy)) continue;
        const isRoad = isRoadTile(gx, gy);
        let col = isRoad ? (roadTier === 0 ? shade(pal.road, 1.08) : roadCol) : grass;
        if (!isRoad && (gx + gy) % 2 === 0) col = shade(col, 0.97);
        tileAt(ctx, eraId, gx, gy, col, isRoad ? (roadTier === 0 ? 'ground/dirt' : 'ground/road') : (gx + gy) % 2 === 0 ? 'ground/grass' : 'ground/grass_alt');
      }
    }
    // 물
    for (let gy = GRID.rows - 1; gy < GRID.rows + 3; gy++) {
      for (let gx = -2; gx < GRID.cols + 2; gx++) {
        const wobble = Math.sin(gx * 0.8 + gy * 0.6 + t * 1.4) * 0.5 + 0.5;
        tileAt(ctx, eraId, gx, gy, shade(night ? shade(pal.water, 0.6) : pal.water, 0.94 + wobble * 0.1), 'ground/water');
      }
    }
    // 차선
    if (roadTier > 0) {
      ctx.strokeStyle = alpha('#FFFFFF', 0.5);
      ctx.lineWidth = Math.max(1, 2 * cam.zoom);
      ctx.setLineDash([6 * cam.zoom, 6 * cam.zoom]);
      for (let gy = 0; gy < GRID.rows; gy += 3) {
        const [ax, ay] = project(0, gy + 0.5, 0, cam);
        const [bx, by] = project(GRID.cols, gy + 0.5, 0, cam);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      for (let gx = 0; gx < GRID.cols; gx += 3) {
        const [ax, ay] = project(gx + 0.5, 0, 0, cam);
        const [bx, by] = project(gx + 0.5, GRID.rows - 1, 0, cam);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 건물 (뒤 -> 앞)
    hitRects.clear();
    const sorted = [...ALL_IDS].sort((a, b) => LOTS[a].gx + LOTS[a].gy - (LOTS[b].gx + LOTS[b].gy));
    const labels: { id: BuildingId; x: number; y: number; unlocked: boolean; alert: BuildingAlert | null }[] = [];
    for (const id of sorted) {
      const lot = LOTS[id];
      const tier = buildingTier(st, id);
      if (tier > (st.collection.seenTiers[id] ?? 0)) st.collection.seenTiers[id] = tier;
      const unlocked = buildingUnlocked(st, id);
      const alert = buildingAlert(st, id, now);

      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.45;
      if (tier === 0) {
        if (!drawTileLot(ctx, eraId, lot.gx, lot.gy, lot.w, lot.h, 'ground/empty')) {
          emptyLotFill(ctx, eraId, lot.gx, lot.gy, lot.w, lot.h);
        }
      } else {
        const keys = buildingKeysFor(eraId, id, tier);
        if (!drawAny(ctx, keys, lot.gx, lot.gy, lot.w, lot.h)) {
          placeholder(ctx, cam, keys[0], lot.gx, lot.gy, lot.w, lot.h, buildingName(st, id));
        }
      }
      ctx.restore();

      // 히트 영역 (발자국 + 높이 여유)
      const corners = [
        project(lot.gx, lot.gy, 0, cam),
        project(lot.gx + lot.w, lot.gy, 0, cam),
        project(lot.gx + lot.w, lot.gy + lot.h, 0, cam),
        project(lot.gx, lot.gy + lot.h, 0, cam),
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const top = Math.min(...ys) - 70 * cam.zoom;
      hitRects.set(id, [Math.min(...xs), top, Math.max(...xs), Math.max(...ys)]);

      const [lx, ly] = project(lot.gx + lot.w / 2, lot.gy + lot.h, 0, cam);
      labels.push({ id, x: lx, y: ly + 12 * cam.zoom, unlocked, alert });
    }

    // 차량 · 시민
    const cars = roadTier === 0 ? 2 : 2 + Math.min(6, roadTier);
    for (let i = 0; i < cars; i++) {
      const lane = (i % 4) * 3;
      const q = ((t * 0.16 + i * 0.31) % 1) * GRID.cols;
      drawAny(ctx, tileKeysFor(eraId, 'props/car_a'), q - 0.4, lane + 0.1, 0.8, 0.8);
    }
    const citizens = clamp(Math.round(2 + Math.log10(1 + st.city.pop) * 3), 2, 18);
    for (let i = 0; i < citizens; i++) {
      const row = (i % 5) * 3;
      const q = ((t * 0.05 + i * 0.17) % 1) * GRID.cols;
      drawAny(ctx, tileKeysFor(eraId, 'props/citizen'), q - 0.3, row + 0.2, 0.6, 0.6);
    }

    // 라벨 · 경고 (화면 좌표)
    ctx.textAlign = 'center';
    for (const l of labels) {
      const name = l.unlocked ? buildingName(st, l.id) : cam.zoom < 0.75 ? '🔒' : `🔒 Lv.${unlockLevel(l.id)}`;
      const fs = clamp(11 * cam.zoom, 9, 13);
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(name).width;
      ctx.fillStyle = alpha('#FFFFFF', 0.88);
      roundRectPath(ctx, l.x - tw / 2 - 7, l.y - fs, tw + 14, fs + 8, (fs + 8) / 2);
      ctx.fill();
      ctx.fillStyle = l.unlocked ? '#2E3A4A' : '#7A8798';
      ctx.fillText(name, l.x, l.y + 1);

      if (l.alert && l.unlocked) {
        const my = l.y - 62 * cam.zoom + Math.sin(t * 3) * 3;
        const r = clamp(13 * cam.zoom, 9, 15);
        ctx.fillStyle =
          l.alert.tone === 'bad' ? '#E85D4A' : l.alert.tone === 'warn' ? '#F5A623' : '#52B788';
        ctx.beginPath();
        ctx.arc(l.x, my, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 ${r}px system-ui, sans-serif`;
        ctx.fillText(l.alert.icon, l.x, my + r * 0.36);
      }
    }
    ctx.textAlign = 'left';

    // 밤 오버레이 (살짝)
    if (night) {
      ctx.fillStyle = alpha('#1B2A44', 0.18);
      ctx.fillRect(0, 0, vw, vh);
    }
    void CONFIG;
  }

  /** 시대 전용 스프라이트를 먼저 시도하고, 없으면 시대 공통으로 떨어진다 */
  function drawAny(ctx: CanvasRenderingContext2D, keys: string[], gx: number, gy: number, w: number, d: number): boolean {
    for (const k of keys) if (drawSprite(ctx, cam, k, gx, gy, w, d)) return true;
    return false;
  }

  /** 부지 전체를 한 종류 타일로 */
  function drawTileLot(ctx: CanvasRenderingContext2D, eraId: string, gx: number, gy: number, w: number, d: number, key: string): boolean {
    const use = tileKeysFor(eraId, key).find((k) => hasSprite(k));
    if (!use) return false;
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) drawTileSprite(ctx, cam, use, gx + x, gy + y);
    return true;
  }

  function emptyLotFill(ctx: CanvasRenderingContext2D, eraId: string, gx: number, gy: number, w: number, d: number): void {
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) tileAt(ctx, eraId, gx + x, gy + y, '#C4B191');
  }

  function tileAt(ctx: CanvasRenderingContext2D, eraId: string, gx: number, gy: number, color: string, key?: string): void {
    if (key) {
      for (const k of tileKeysFor(eraId, key)) if (drawTileSprite(ctx, cam, k, gx, gy)) return;
    }
    const a = project(gx, gy, 0, cam);
    const b = project(gx + 1, gy, 0, cam);
    const c = project(gx + 1, gy + 1, 0, cam);
    const d = project(gx, gy + 1, 0, cam);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number): void {
    const rad = Math.min(r, w / 2, hh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + hh, rad);
    ctx.arcTo(x + w, y + hh, x, y + hh, rad);
    ctx.arcTo(x, y + hh, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  return { root, update: () => {}, draw, focus };
}
