import { BUSINESSES } from '../data/businesses';
import { FACILITY_BY_ID, isFacilityId, type BuildingId, type FacilityId } from '../data/buildings';
import { totalCashPerSecond, stats } from '../core/economy';
import { buildableFacilities, facilityCost } from '../core/facilities';
import { formatInt, formatNumber } from '../core/num';
import { cityProgress } from '../core/progression';
import { missionComplete } from '../core/missions';
import type { Game } from '../core/game';
import type { BusinessDef, BusinessId } from '../core/types';
import { clear, h } from './dom';
import { createBusinessView, type View } from './businessView';
import { createFacilityView } from './facilityView';
import { createCityMap, buildingAlert } from './cityMap';
import { createTutorial } from './tutorial';
import { shake } from './fx';
import { audioReady, setSoundEnabled, sfx, unlockAudio } from '../core/audio';
import { bizIcon, bizName, facIcon, facName, leaderTitle, settlementName } from '../core/era';
import {
  showBuildSheet,
  showCityLevelSheet,
  showCollectionSheet,
  showEraSheet,
  showMenuSheet,
  showMissionSheet,
  showOfflineModal,
  showUnlockModal,
} from './modals';

type Screen = { kind: 'city' } | { kind: 'building'; id: BuildingId };

export function mountApp(game: Game, host: HTMLElement): void {
  let screen: Screen = { kind: 'city' };
  const buildingViews = new Map<BuildingId, View>();

  // ── 상단바 ──
  const idChip = h('button', { class: 'id-chip' }, '');
  const backBtn = h('button', { class: 'id-chip back' }, '←');
  const matEl = h('span', { class: 'top-res' }, '');
  const cashEl = h('span', { class: 'top-res gold' }, '');
  const rateEl = h('span', { class: 'top-rate' }, '');
  const titleEl = h('div', { class: 'top-title' }, '');
  const topbar = h(
    'div',
    { class: 'topbar' },
    h('div', { class: 'topbar-row' }, backBtn, idChip, titleEl, h('div', { class: 'grow' }), matEl, h('div', { class: 'cash-wrap' }, cashEl, rateEl)),
  );

  // ── 메인 뷰 ──
  const map = createCityMap(game, (id) => enterBuilding(id));
  const stage = h('div', { class: 'stage' }, map.root);
  const buildingHost = h('div', { class: 'view building-view', style: { display: 'none' } });
  stage.appendChild(buildingHost);

  // ── 지도 위 빠른 액션 ──
  const quickBuild = h('button', { class: 'quick', 'data-tut': 'build' }, '');
  const quickLevel = h('button', { class: 'quick' }, '');
  // 문명 전환이 가능해지면 지도 위에 바로 뜬다 (이 게임의 장기 루프라 숨기지 않는다)
  const quickEra = h('button', { class: 'quick era', style: { display: 'none' } }, '');
  const quickRow = h('div', { class: 'quick-row' }, quickBuild, quickLevel, quickEra);
  stage.appendChild(quickRow);

  // ── 하단 메뉴바 ──
  const menuItems: { key: string; icon: string; label: string; run: () => void }[] = [
    { key: 'dex', icon: '📖', label: '도감', run: () => showCollectionSheet(game) },
    { key: 'menu', icon: '☰', label: '메뉴', run: () => showMenuSheet(game) },
    { key: 'level', icon: '🏙️', label: '레벨', run: () => showCityLevelSheet(game) },
    { key: 'build', icon: '🔨', label: '건설', run: () => showBuildSheet(game, (id: string) => enterBuilding(id as BuildingId)) },
    { key: 'mission', icon: '📋', label: '미션', run: () => showMissionSheet(game) },
  ];
  const menubar = h('div', { class: 'menubar' });
  const menuDots = new Map<string, HTMLElement>();
  for (const item of menuItems) {
    const dot = h('span', { class: 'dot', style: { display: 'none' } });
    menuDots.set(item.key, dot);
    menubar.appendChild(
      h('button', { onclick: item.run }, h('span', { class: 'ic' }, item.icon), item.label, dot),
    );
  }

  // 첫 60초 튜토리얼 — 조작 하나씩 짚어 준다
  const tutorial = createTutorial(game, {
    screen: () => (screen.kind === 'city' ? 'city' : screen.id),
    mapRect: (id) => (screen.kind === 'city' ? map.rectOf(id) : null),
  });

  const toasts = h('div', { class: 'toasts' });
  const shell = h('div', { class: 'shell' }, topbar, stage, toasts, menubar, tutorial.root);
  clear(host);
  host.appendChild(shell);

  idChip.addEventListener('click', () => showMenuSheet(game));
  backBtn.addEventListener('click', () => goCity());
  quickBuild.addEventListener('click', () => showBuildSheet(game, (id: string) => enterBuilding(id as BuildingId)));
  quickLevel.addEventListener('click', () => showCityLevelSheet(game));
  quickEra.addEventListener('click', () => showEraSheet(game));

  // ── 화면 전환 ──
  function enterBuilding(id: BuildingId): void {
    const st = game.state;
    if (isFacilityId(id)) {
      const def = FACILITY_BY_ID[id];
      if (st.city.level < def.unlockCityLevel) {
        game.toast(`도시 레벨 ${def.unlockCityLevel}에 열립니다`);
        return;
      }
    } else {
      const def = BUSINESSES.find((b) => b.id === id)!;
      if (st.city.level < def.unlockCityLevel) {
        game.toast(`도시 레벨 ${def.unlockCityLevel}에 열립니다`);
        return;
      }
    }
    screen = { kind: 'building', id };
    let view = buildingViews.get(id);
    if (!view) {
      view = isFacilityId(id)
        ? createFacilityView(game, id as FacilityId)
        : createBusinessView(game, id as BusinessId);
      buildingViews.set(id, view);
    }
    clear(buildingHost);
    buildingHost.appendChild(view.root);
    buildingHost.scrollTop = 0;
    applyScreen();
    view.update();
  }

  function goCity(): void {
    screen = { kind: 'city' };
    applyScreen();
  }

  function applyScreen(): void {
    const inBuilding = screen.kind === 'building';
    buildingHost.style.display = inBuilding ? '' : 'none';
    map.root.style.display = inBuilding ? 'none' : '';
    quickRow.style.display = inBuilding ? 'none' : '';
    menubar.style.display = inBuilding ? 'none' : '';
    backBtn.style.display = inBuilding ? '' : 'none';
    idChip.style.display = inBuilding ? 'none' : '';
    titleEl.style.display = inBuilding ? '' : 'none';
    shell.classList.toggle('in-building', inBuilding);
    if (inBuilding && screen.kind === 'building') {
      const id = screen.id;
      const st = game.state;
      titleEl.textContent = isFacilityId(id)
        ? `${facIcon(st, id)} ${facName(st, id)}`
        : `${bizIcon(st, id as BusinessId)} ${bizName(st, id as BusinessId)}`;
    }
  }

  // ── 갱신 ──
  function updateTop(): void {
    const s = game.state;
    const fmt = (v: number) => formatNumber(v, s.settings.notation);
    idChip.innerHTML = '';
    idChip.append(
      h('span', { class: 'era-chip' }, game.era().short),
      ' ',
      h('b', null, `${leaderTitle(s)} Lv.${s.city.level}`),
    );
    matEl.innerHTML = '';
    matEl.append('📦 ', h('b', null, fmt(s.resources.material)));
    if (s.resources.gem > 0) matEl.append(h('span', { class: 'gem' }, ` 💎 ${formatInt(s.resources.gem)}`));
    cashEl.innerHTML = '';
    cashEl.append('💰 ', h('b', null, fmt(s.resources.cash)));
    rateEl.textContent = `+${fmt(totalCashPerSecond(s))}/초`;
  }

  function updateQuick(): void {
    const s = game.state;
    const buildable = buildableFacilities(s);
    const ready = buildable.filter((f) => s.resources.cash >= facilityCost(s, f.id)).length;
    quickBuild.innerHTML = '';
    quickBuild.className = `quick ${ready > 0 ? 'gold' : ''}`;
    quickBuild.append('🔨 건설', h('span', { class: 'btn-sub' }, ready > 0 ? `${ready}곳 가능` : `${buildable.length}곳 대기`));

    const eraReady = game.canAdvanceEra();
    quickEra.style.display = eraReady ? '' : 'none';
    if (eraReady) {
      quickEra.innerHTML = '';
      quickEra.append(
        `🏛️ ${game.isFinalEra() ? '재건' : game.nextEra().name}`,
        h('span', { class: 'btn-sub' }, '도시를 허물고 전환'),
      );
    }

    const prog = cityProgress(s);
    quickLevel.innerHTML = '';
    quickLevel.append(
      `🏙️ ${settlementName(s)} Lv.${s.city.level}`,
      h('span', { class: 'btn-sub' }, `${Math.round(prog.ratio * 100)}%`),
    );
  }

  function updateDots(): void {
    const s = game.state;
    const missionReady = s.missions.ids.some((_, i) => missionComplete(s, i) && !s.missions.claimed[i]);
    menuDots.get('mission')!.style.display = missionReady ? '' : 'none';
    const buildReady = buildableFacilities(s).some((f) => s.resources.cash >= facilityCost(s, f.id));
    menuDots.get('build')!.style.display = buildReady ? '' : 'none';
    const menuReady = !s.attendance.claimedToday || game.canAdvanceEra();
    menuDots.get('menu')!.style.display = menuReady ? '' : 'none';
    const cs = stats(s);
    menuDots.get('level')!.style.display = cs.powerEff < 1 || cs.laborSupply < cs.popDemand ? '' : 'none';
  }

  function applySettings(): void {
    const s = game.state.settings;
    document.documentElement.style.setProperty('--scale', String(s.textScale));
    document.body.classList.toggle('reduced', s.reducedMotion);
    setSoundEnabled(s.sound);
  }

  let last = 0;
  function frame(t: number): void {
    const secs = t / 1000;
    if (screen.kind === 'city') map.draw(secs);
    else buildingViews.get(screen.id)?.draw?.(secs);
    tutorial.update();
    if (t - last >= 100) {
      last = t;
      updateTop();
      if (screen.kind === 'city') {
        updateQuick();
        updateDots();
      } else {
        buildingViews.get(screen.id)?.update();
      }
    }
    requestAnimationFrame(frame);
  }

  game.on('toast', (msg) => {
    const el = h('div', { class: 'toast' }, String(msg));
    toasts.appendChild(el);
    while (toasts.childElementCount > 3) toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), 2400);
  });
  game.on('structure', () => {
    applySettings();
    updateTop();
    if (screen.kind === 'building') buildingViews.get(screen.id)?.update();
    else {
      updateQuick();
      updateDots();
    }
  });
  game.on('unlock', (def) => {
    shake(stage, 'hit', game.state.settings.reducedMotion);
    showUnlockModal(game, def as BusinessDef);
  });
  game.on('quake', () => shake(stage, 'quake', game.state.settings.reducedMotion));
  game.on('cityEvent', () => {
    sfx('deny');
    shake(stage, 'hit', game.state.settings.reducedMotion);
  });
  // 재화 획득 연출: 코인이 상단바로 날아간다 (아트 스타일 9장)
  game.on('coin', () => {
    if (game.state.settings.reducedMotion) return;
    const target = cashEl.getBoundingClientRect();
    const from = stage.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      const sx = from.left + from.width * (0.3 + Math.random() * 0.4);
      const sy = from.top + from.height * (0.3 + Math.random() * 0.3);
      const el = h('div', {
        class: 'coin',
        style: {
          left: `${sx}px`,
          top: `${sy}px`,
          '--dx': `${target.left + target.width / 2 - sx}px`,
          '--dy': `${target.top + 8 - sy}px`,
          animationDelay: `${i * 55}ms`,
        } as unknown as string,
      }, '🪙');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900 + i * 55);
    }
  });
  game.on('cityEvent', (n) => {
    const notice = n as { target?: string };
    if (notice.target && screen.kind === 'city') map.focus(notice.target as BuildingId);
  });

  // 브라우저 자동재생 정책: 오디오는 첫 입력 이후에만 만들 수 있다
  window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

  applySettings();
  applyScreen();
  requestAnimationFrame(frame);

  if (game.pendingOffline) showOfflineModal(game, game.pendingOffline);

  // 병목이 생긴 건물로 바로 이동하는 헬퍼 (도시 화면 롱프레스 대체)
  (window as unknown as Record<string, unknown>).goto = (id: string) => enterBuilding(id as BuildingId);
  (window as unknown as Record<string, unknown>).audioReady = () => audioReady();
  void buildingAlert;
}
