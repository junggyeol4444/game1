import { BUSINESSES } from '../data/businesses';
import { isUnlocked, totalCashPerSecond } from '../core/economy';
import { formatInt, formatNumber } from '../core/num';
import { cityProgress } from '../core/progression';
import { missionComplete } from '../core/missions';
import type { Game } from '../core/game';
import type { BusinessDef, BusinessId } from '../core/types';
import { clear, h } from './dom';
import { createBusinessView, type View } from './businessView';
import { createCityView } from './cityView';
import { showOfflineModal, showUnlockModal } from './modals';

type TabId = 'city' | BusinessId;

export function mountApp(game: Game, host: HTMLElement): void {
  let current: TabId = 'city';
  const views = new Map<TabId, View>();

  const cashEl = h('div', { class: 'cash' }, '');
  const popChip = h('span', { class: 'top-chip' }, '');
  const bpChip = h('span', { class: 'top-chip' }, '');
  const cityLv = h('span', { class: 'lv' }, '');
  const cityBar = h('i', { style: { width: '0%' } });

  const topbar = h(
    'div',
    { class: 'topbar' },
    h('div', { class: 'topbar-row' }, cashEl, popChip, bpChip),
    h('div', { class: 'citybar' }, cityLv, h('div', { class: 'bar' }, cityBar)),
  );

  const viewHost = h('div', { class: 'view' });
  const tabbar = h('div', { class: 'tabbar' });
  const toasts = h('div', { class: 'toasts' });
  const shell = h('div', { class: 'shell' }, topbar, viewHost, toasts, tabbar);

  clear(host);
  host.appendChild(shell);

  function select(tab: TabId): void {
    current = tab;
    let view = views.get(tab);
    if (!view) {
      view = tab === 'city' ? createCityView(game, select) : createBusinessView(game, tab);
      views.set(tab, view);
    }
    clear(viewHost);
    viewHost.appendChild(view.root);
    viewHost.scrollTop = 0;
    view.update();
    buildTabbar();
  }

  function buildTabbar(): void {
    clear(tabbar);
    const missionReady = game.state.missions.ids.some(
      (_, i) => missionComplete(game.state, i) && !game.state.missions.claimed[i],
    );
    const attendReady = !game.state.attendance.claimedToday;
    const items: { id: TabId; icon: string; label: string; locked: boolean; dot: boolean }[] = [
      { id: 'city', icon: '🏙️', label: '도시', locked: false, dot: missionReady || attendReady },
      ...BUSINESSES.map((def) => ({
        id: def.id as TabId,
        icon: isUnlocked(game.state, def) ? def.icon : '🔒',
        label: def.name,
        locked: !isUnlocked(game.state, def),
        dot: false,
      })),
    ];
    for (const item of items) {
      const btn = h(
        'button',
        {
          class: `${current === item.id ? 'on' : ''} ${item.locked ? 'locked' : ''}`,
          onclick: () => {
            if (item.locked) {
              const def = BUSINESSES.find((b) => b.id === item.id);
              game.toast(def ? `도시 레벨 ${def.unlockCityLevel}에서 열립니다` : '');
              return;
            }
            select(item.id);
          },
        },
        h('span', { class: 'ic' }, item.icon),
        item.label,
        item.dot ? h('span', { class: 'dot' }) : null,
      );
      tabbar.appendChild(btn);
    }
  }

  function updateTop(): void {
    const s = game.state;
    const fmt = (v: number) => formatNumber(v, s.settings.notation);
    cashEl.innerHTML = '';
    cashEl.append(fmt(s.resources.cash), h('small', null, `+${fmt(totalCashPerSecond(s))}/초`));
    popChip.innerHTML = '';
    popChip.append('🧑 ', h('b', null, formatInt(s.resources.pop, s.settings.notation)));
    popChip.style.display = s.resources.pop > 0 ? '' : 'none';
    bpChip.innerHTML = '';
    bpChip.append('📐 ', h('b', null, formatInt(s.resources.blueprint, s.settings.notation)));
    bpChip.style.display = s.resources.blueprint > 0 || s.prestige.count > 0 ? '' : 'none';
    const prog = cityProgress(s);
    cityLv.textContent = `도시 Lv.${s.city.level}`;
    cityBar.style.width = `${prog.ratio * 100}%`;
  }

  function applySettings(): void {
    const s = game.state.settings;
    document.documentElement.style.setProperty('--scale', String(s.textScale));
    document.body.classList.toggle('reduced', s.reducedMotion);
  }

  let last = 0;
  function frame(t: number): void {
    const view = views.get(current);
    // 장면은 매 프레임, 숫자/버튼은 10Hz
    view?.draw?.(t / 1000);
    if (t - last >= 100) {
      last = t;
      updateTop();
      view?.update();
    }
    requestAnimationFrame(frame);
  }

  game.on('toast', (msg) => {
    const el = h('div', { class: 'toast' }, String(msg));
    toasts.appendChild(el);
    while (toasts.childElementCount > 3) toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), 2200);
  });
  game.on('structure', () => {
    applySettings();
    updateTop();
    views.get(current)?.update();
    buildTabbar();
  });
  game.on('unlock', (def) => {
    const b = def as BusinessDef;
    buildTabbar();
    showUnlockModal(b);
  });

  applySettings();
  select('city');
  requestAnimationFrame(frame);

  if (game.pendingOffline) showOfflineModal(game, game.pendingOffline);
}
