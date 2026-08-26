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
  type Lot,
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
import { dustPuff } from './scene/burst';
import { bizName, currentEra, eraPalette, facName, resourceName, seenKey } from '../core/era';

/** 도시 규모 이름은 시대마다 다르다 (석기 '큰 부족' ~ 우주 '성간 도시') */

export interface MapView {
  root: HTMLElement;
  update: () => void;
  draw: (t: number) => void;
  focus: (id: BuildingId) => void;
  /** 건물이 지금 화면 어디에 그려졌는지 (튜토리얼 하이라이트용) */
  rectOf: (id: BuildingId) => DOMRect | null;
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
        text: `${resourceName(state, def.input.resource)} 부족 — 가동률 ${Math.round(eff * 100)}%`,
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
  /** 지금 화면에 그려진 외형 단계. 이게 바뀌면 먼지가 인다 (아트 문서 6장) */
  const shownTier = new Map<BuildingId, number>();
  /** 교체 연출 시작 시각(초) */
  const swapAt = new Map<BuildingId, number>();
  const SWAP_SECONDS = 0.8;

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
  /** 도시 전체가 가로로 딱 들어가는 배율 */
  function fitZoom(): number {
    const b = bounds();
    return viewW() / (b.maxX - b.minX);
  }
  function minZoom(): number {
    return fitZoom() * 0.85;
  }
  /**
   * 처음 보여줄 배율.
   *
   * 2:1 아이소라서 어떤 격자든 화면 비율이 항상 2:1 이다 — 세로로 긴 폰에서
   * "도시 전체를 한 화면에" 를 지키면 도시가 가운데 띠로 눌리고 위아래가 전부 들판이 된다
   * (10x16 격자 = 화면 832x516, 세로 여백의 60%가 남았다).
   * 그래서 시작은 **세로를 채우는 쪽**에 맞추고 좌우는 밀어서 본다.
   * 전체를 보고 싶으면 손가락으로 오므리면 된다 — minZoom 은 그대로 두었다.
   */
  function startZoom(): number {
    const b = bounds();
    const fill = ((viewH() - UI_BOTTOM) * 0.65) / (b.maxY - b.minY);
    return clamp(fill, fitZoom(), fitZoom() * 2.2);
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

  /**
   * 처음 화면을 어디에 맞출지.
   *
   * 전체가 한 화면에 안 들어오는 배율로 시작하니(startZoom 주석 참고) 격자 한가운데를
   * 잡으면 초반엔 빈 부지만 보인다. 그래서 **지어진 건물들의 한가운데**를 잡는다.
   * 아무것도 없으면 광산 — 튜토리얼이 가리키는 곳이고 처음 열리는 사업이다.
   */
  function startCenter(): void {
    const built = ALL_IDS.filter((id) => buildingTier(game.state, id) > 0);
    if (built.length === 0) {
      focus('mine');
      return;
    }
    let gx = 0;
    let gy = 0;
    for (const id of built) {
      gx += LOTS[id].gx + LOTS[id].w / 2;
      gy += LOTS[id].gy + LOTS[id].h / 2;
    }
    gx /= built.length;
    gy /= built.length;
    cam.x = (gx - gy) * (TW / 2);
    cam.y = (gx + gy) * (TH / 2);
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
      cam.zoom = startZoom();
      startCenter();
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
        // 도시 밖은 한 단계 눌러서 부지 경계가 보이게 한다
        const f = water
          ? (night ? 0.6 : 1) * (0.93 + wob * 0.1)
          : (night ? 0.66 : 0.9) * ((gx + gy) % 2 === 0 ? 1 : 0.97);
        tileAt(ctx, eraId, gx, gy, col, water ? 'ground/water' : 'ground/grass', f);
      }
    }
    // 바깥 나무.
    // 도시가 아직 작을 때 화면 대부분이 들판이라, 나무가 성기면 그냥 빈 잔디밭으로 보인다.
    // 뒤에서 앞으로 그려야 앞 나무가 뒤 나무를 가린다.
    const outTrees: [number, number, number][] = [];
    for (let i = 0; i < 90; i++) {
      const seed = (i * 2654435761) >>> 0;
      const rx = ((seed >>> 8) % 1009) / 1009;
      const ry = ((seed >>> 17) % 1013) / 1013;
      const rs = ((seed >>> 3) % 1021) / 1021;
      const gx = -OUT + rx * (GRID.cols + OUT * 2);
      const gy = -OUT + ry * (GRID.rows - 1 + OUT);
      if (gx > -1.5 && gx < GRID.cols + 0.5 && gy > -1.5 && gy < GRID.rows + 0.5) continue;
      if (gy >= GRID.rows - 1) continue; // 물 위에는 안 심는다
      outTrees.push([gx, gy, 0.75 + rs * 0.55]);
    }
    outTrees.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [gx, gy, sz] of outTrees) {
      drawAny(ctx, tileKeysFor(eraId, 'props/tree'), gx - sz / 2, gy - sz / 2, sz, sz, night ? 0.66 : 0.9);
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
        const f = (night ? (isRoad ? 0.68 : 0.72) : 1) * (!isRoad && (gx + gy) % 2 === 0 ? 0.97 : 1);
        tileAt(ctx, eraId, gx, gy, col, isRoad ? (roadTier === 0 ? 'ground/dirt' : 'ground/road') : (gx + gy) % 2 === 0 ? 'ground/grass' : 'ground/grass_alt', f);
      }
    }
    // 물
    for (let gy = GRID.rows - 1; gy < GRID.rows + 3; gy++) {
      for (let gx = -2; gx < GRID.cols + 2; gx++) {
        const wobble = Math.sin(gx * 0.8 + gy * 0.6 + t * 1.4) * 0.5 + 0.5;
        tileAt(ctx, eraId, gx, gy, shade(night ? shade(pal.water, 0.6) : pal.water, 0.94 + wobble * 0.1), 'ground/water', (night ? 0.6 : 1) * (0.94 + wobble * 0.1));
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

    // 차량 · 시민 — 건물 사이에 깊이 순서대로 끼워 그린다.
    //
    // 예전엔 건물을 다 그린 뒤 몰아 그렸다. 배율이 낮을 땐 티가 안 났는데
    // 지금 배율에선 차가 공중에 뜨고 사람이 지붕 위에 선다.
    //
    // 아이소에서 `gx + gy` 한 숫자로 정렬하는 흔한 방법은 여기서 안 통한다 —
    // 멀리 떨어진 두 상자에는 그 합이 앞뒤를 뜻하지 않는다
    // (세로 도로 gx=9 를 달리는 차는 합이 크지만 gy=1 의 건물보다 뒤에 있다).
    // 축 정렬 상자끼리는 이 판정이 정확하다:
    //   A 가 B 보다 뒤 <=> A 가 두 축 중 하나에서 B 보다 완전히 앞쪽에 끝난다.
    // 건물을 뒤에서 앞으로 돌면서, **처음으로 자기보다 앞인 건물**을 만나기 직전에
    // 프롭을 내보낸다. 그 앞의 건물들은 전부 그 프롭보다 뒤라는 게 보장된다.
    interface Prop {
      gx: number;
      gy: number;
      w: number;
      drawn: boolean;
      draw: () => void;
    }
    const props: Prop[] = [];
    {
      const nf = night ? 0.72 : 1;
      const put = (gx: number, gy: number, w: number, key: string): void => {
        props.push({
          gx,
          gy,
          w,
          drawn: false,
          draw: () => drawAny(ctx, tileKeysFor(eraId, key), gx, gy, w, w, nf),
        });
      };
      const cars = roadTier === 0 ? 2 : 2 + Math.min(6, roadTier);
      for (let i = 0; i < cars; i++) {
        const lane = (i % 4) * 3;
        put(((t * 0.16 + i * 0.31) % 1) * GRID.cols - 0.4, lane + 0.1, 0.8, 'props/car_a');
      }
      // 세로 도로 (car_b 는 반대 방향을 보는 그림이다)
      for (let i = 0; i < cars; i++) {
        const lane = (i % 4) * 3;
        put(lane + 0.1, ((t * 0.13 + i * 0.27) % 1) * GRID.rows - 0.4, 0.8, 'props/car_b');
      }
      const citizens = clamp(Math.round(2 + Math.log10(1 + st.city.pop) * 3), 2, 18);
      for (let i = 0; i < citizens; i++) {
        const row = (i % 5) * 3;
        put(((t * 0.05 + i * 0.17) % 1) * GRID.cols - 0.3, row + 0.2, 0.6, 'props/citizen');
      }
    }
    /** 프롭이 이 부지보다 뒤에 있나 */
    const propBehind = (p: Prop, lot: Lot): boolean =>
      p.gx + p.w <= lot.gx || p.gy + p.w <= lot.gy;
    const flushProps = (lot: Lot | null): void => {
      for (const p of props) {
        if (p.drawn) continue;
        if (lot && !propBehind(p, lot)) continue;
        p.drawn = true;
        p.draw();
      }
    };

    // 건물 (뒤 -> 앞)
    hitRects.clear();
    const sorted = [...ALL_IDS].sort((a, b) => LOTS[a].gx + LOTS[a].gy - (LOTS[b].gx + LOTS[b].gy));
    const labels: { id: BuildingId; x: number; y: number; unlocked: boolean; alert: BuildingAlert | null }[] = [];
    for (const id of sorted) {
      const lot = LOTS[id];
      flushProps(lot);
      const tier = buildingTier(st, id);
      const dexKey = seenKey(eraId, id);
      if (tier > (st.collection.seenTiers[dexKey] ?? 0)) st.collection.seenTiers[dexKey] = tier;
      const unlocked = buildingUnlocked(st, id);
      const alert = buildingAlert(st, id, now);

      // 외형 단계가 바뀌면 0.8초 먼지로 교체를 가린다.
      // 첫 프레임에는 연출하지 않는다 — 세이브 불러오기가 폭죽이 되면 안 된다
      const prevTier = shownTier.get(id);
      if (prevTier === undefined) shownTier.set(id, tier);
      else if (prevTier !== tier) {
        shownTier.set(id, tier);
        if (!st.settings.reducedMotion) swapAt.set(id, t);
      }

      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.45;
      const nf = night ? 0.72 : 1;
      if (tier === 0) {
        if (!drawTileLot(ctx, eraId, lot.gx, lot.gy, lot.w, lot.h, 'ground/empty', nf)) {
          emptyLotFill(ctx, eraId, lot.gx, lot.gy, lot.w, lot.h);
        }
      } else {
        const keys = buildingKeysFor(eraId, id, tier);
        if (!drawAny(ctx, keys, lot.gx, lot.gy, lot.w, lot.h, nf)) {
          placeholder(ctx, cam, keys[0], lot.gx, lot.gy, lot.w, lot.h, buildingName(st, id));
        }
      }
      const swap = swapAt.get(id);
      if (swap !== undefined) {
        const age = (t - swap) / SWAP_SECONDS;
        if (age >= 1) swapAt.delete(id);
        else {
          const [dx, dy] = project(lot.gx + lot.w / 2, lot.gy + lot.h / 2, 0, cam);
          dustPuff(ctx, dx, dy, TW * lot.w * cam.zoom, age);
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

    flushProps(null);

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
  function drawAny(
    ctx: CanvasRenderingContext2D,
    keys: string[],
    gx: number,
    gy: number,
    w: number,
    d: number,
    shadeF = 1,
  ): boolean {
    for (const k of keys) if (drawSprite(ctx, cam, k, gx, gy, w, d, shadeF)) return true;
    return false;
  }

  /** 부지 전체를 한 종류 타일로 */
  function drawTileLot(ctx: CanvasRenderingContext2D, eraId: string, gx: number, gy: number, w: number, d: number, key: string, shadeF = 1): boolean {
    const use = tileKeysFor(eraId, key).find((k) => hasSprite(k));
    if (!use) return false;
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) drawTileSprite(ctx, cam, use, gx + x, gy + y, shadeF);
    return true;
  }

  function emptyLotFill(ctx: CanvasRenderingContext2D, eraId: string, gx: number, gy: number, w: number, d: number): void {
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) tileAt(ctx, eraId, gx + x, gy + y, '#C4B191');
  }

  function tileAt(
    ctx: CanvasRenderingContext2D,
    eraId: string,
    gx: number,
    gy: number,
    color: string,
    key?: string,
    shadeF = 1,
  ): void {
    if (key) {
      for (const k of tileKeysFor(eraId, key)) if (drawTileSprite(ctx, cam, k, gx, gy, shadeF)) return;
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

  function rectOf(id: BuildingId): DOMRect | null {
    const r = hitRects.get(id);
    if (!r) return null;
    const c = canvas.getBoundingClientRect();
    return new DOMRect(c.left + r[0], c.top + r[1], r[2] - r[0], r[3] - r[1]);
  }

  return { root, update: () => {}, draw, focus, rectOf };
}
