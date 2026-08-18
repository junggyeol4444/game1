import { CONFIG } from '../data/config';
import { RESOURCE_META } from '../data/businesses';
import {
  businessRatePerSecond,
  chainActive,
  cycleTime,
  isAutomated,
  isBoosted,
  managerCost,
  nextMilestone,
  outputPerCycle,
  projectedEfficiency,
  unitCost,
  unitMaxAffordable,
} from '../core/economy';
import { formatClock, formatInt, formatNumber } from '../core/num';
import type { Game, BuyMode } from '../core/game';
import type { BusinessId } from '../core/types';
import { h, haptic } from './dom';
import { showCashDropSheet } from './modals';

const BUY_MODES: BuyMode[] = [1, 10, 100, 'max'];

export interface View {
  root: HTMLElement;
  update: () => void;
}

export function createBusinessView(game: Game, id: BusinessId): View {
  const def = game.def(id);
  const s = game.state;
  const fmt = (v: number) => formatNumber(v, s.settings.notation);

  const rateEl = h('b', { class: 'gold' }, '');
  const stockEl = h('span', { class: 'small' }, '');
  const effChip = h('span', { class: 'chip' }, '');
  const boostChip = h('span', { class: 'chip on', style: { display: 'none' } }, '');

  const boostBtn = h(
    'button',
    {
      class: 'ad grow',
      onclick: async () => {
        haptic(s.settings.haptics);
        await game.adBoost(id);
      },
    },
    `${CONFIG.ads.boostFactor}배 부스터`,
    h('span', { class: 'btn-sub' }, `광고 · ${Math.round(CONFIG.ads.boostSeconds / 60)}분`),
  );
  const trialBtn = h(
    'button',
    {
      class: 'ad grow',
      onclick: async () => {
        haptic(s.settings.haptics);
        await game.adTrialManager(id);
      },
    },
    '임시 매니저',
    h('span', { class: 'btn-sub' }, `광고 · ${Math.round(CONFIG.ads.trialManagerSeconds / 60)}분 자동`),
  );

  const header = h(
    'div',
    { class: 'card', style: { borderColor: def.color } },
    h(
      'div',
      { class: 'row' },
      h('span', { style: { fontSize: '28px' } }, def.icon),
      h('div', { class: 'grow' }, h('div', { style: { fontWeight: '800' } }, def.name), h('div', { class: 'small muted' }, def.subtitle)),
      h('div', { class: 'center' }, rateEl, h('div', { class: 'small muted' }, '초당')),
    ),
    h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'wrap', gap: '6px' } }, stockEl, effChip, boostChip),
    h('div', { class: 'row', style: { marginTop: '8px', gap: '6px' } }, boostBtn, trialBtn),
  );

  // 구매 단위 선택
  const segButtons = BUY_MODES.map((m) =>
    h(
      'button',
      {
        class: game.buyMode === m ? 'on' : '',
        onclick: () => {
          game.buyMode = m;
          segButtons.forEach((b, i) => b.classList.toggle('on', BUY_MODES[i] === m));
          update();
        },
      },
      m === 'max' ? 'MAX' : `x${m}`,
    ),
  );
  const seg = h('div', { class: 'card' }, h('h3', null, '한 번에 구매'), h('div', { class: 'seg' }, ...segButtons));

  // 유닛 행
  const unitRows = def.units.map((udef, i) => {
    const lvlEl = h('span', { class: 'lvl' }, '0');
    const iconEl = h('div', { class: 'u-icon' }, h('span', null, def.icon), lvlEl);
    const barFill = h('i', { style: { width: '0%' } });
    const barText = h('span', null, '');
    const metaEl = h('div', { class: 'u-meta' }, '');
    const msEl = h('div', { class: 'u-meta' }, '');
    const buyBtn = h('button', { class: '' }, '');
    const mgrBtn = h('button', { class: '' }, '');

    iconEl.addEventListener('click', () => {
      const st = game.state.businesses[id].units[i];
      if (st.level <= 0) return;
      if (game.tapUnit(id, i)) haptic(game.state.settings.haptics);
    });

    buyBtn.addEventListener('click', () => {
      const st = game.state.businesses[id].units[i];
      const count = game.buyMode === 'max' ? unitMaxAffordable(game.state, def, i) : game.buyMode;
      const cost = unitCost(game.state, def, i, Math.max(1, count));
      if (game.state.resources.cash < cost) {
        showCashDropSheet(game);
        return;
      }
      if (game.buyUnit(id, i)) {
        haptic(game.state.settings.haptics);
        floaty(iconEl, `+${st.level > 0 ? count : 1}`);
      }
    });

    mgrBtn.addEventListener('click', () => {
      const cost = managerCost(def, i);
      if (game.state.resources.cash < cost) {
        showCashDropSheet(game);
        return;
      }
      game.buyManager(id, i);
    });

    const row = h(
      'div',
      { class: 'unit' },
      iconEl,
      h(
        'div',
        { class: 'grow' },
        h('div', { class: 'u-name' }, udef.name),
        metaEl,
        h('div', { class: 'u-bar' }, barFill, barText),
        msEl,
      ),
      h('div', { class: 'u-actions' }, buyBtn, mgrBtn),
    );

    return { row, lvlEl, iconEl, barFill, barText, metaEl, msEl, buyBtn, mgrBtn, udef, i };
  });

  const root = h('div', null, header, seg, ...unitRows.map((u) => u.row));

  function update(): void {
    const st = game.state;
    const now = Date.now();
    const bs = st.businesses[id];
    const eff = projectedEfficiency(st, def, now);
    const rate = businessRatePerSecond(st, def, now);

    rateEl.textContent = fmt(rate.cash * eff);

    const meta = RESOURCE_META[def.output];
    stockEl.textContent =
      def.output === 'cash'
        ? `누적 매출 ${fmt(bs.totalProduced)}`
        : `${meta.icon} ${meta.name} ${fmt(st.resources[def.output])}`;

    if (def.input && chainActive(st)) {
      const inMeta = RESOURCE_META[def.input.resource];
      const pct = Math.round(eff * 100);
      effChip.textContent = `가동률 ${pct}% · ${inMeta.icon}${inMeta.name} ${fmt(st.resources[def.input.resource])}`;
      effChip.className = `chip ${pct >= 95 ? 'on' : 'warn'}`;
      effChip.style.display = '';
    } else if (def.input) {
      effChip.textContent = `도시 Lv.${CONFIG.chainStartLevel}부터 ${RESOURCE_META[def.input.resource].name} 필요`;
      effChip.className = 'chip';
      effChip.style.display = '';
    } else {
      effChip.style.display = 'none';
    }

    if (isBoosted(st, id, now)) {
      boostChip.style.display = '';
      boostChip.textContent = `⚡ ${CONFIG.ads.boostFactor}배 ${formatClock((bs.boostUntil - now) / 1000)}`;
    } else {
      boostChip.style.display = 'none';
    }

    const boostReady = game.ads.isAvailable('tabBoost');
    boostBtn.disabled = !boostReady;
    const trialReady = game.ads.isAvailable('trialManager');
    const allManaged = bs.units.every((u) => u.level <= 0 || u.manager);
    trialBtn.style.display = allManaged ? 'none' : '';
    trialBtn.disabled = !trialReady || bs.trialUntil > now;

    for (const u of unitRows) {
      const state = bs.units[u.i];
      const owned = state.level > 0;
      u.row.classList.toggle('locked', !owned);
      u.lvlEl.textContent = owned ? `Lv.${formatInt(state.level)}` : '미건설';

      const auto = isAutomated(st, id, u.i, now);
      u.iconEl.classList.toggle('tappable', owned && !auto && !state.running);

      const ct = cycleTime(st, def, u.i);
      const per = outputPerCycle(st, def, u.i, now) * eff;
      u.metaEl.textContent = owned
        ? `1회 ${fmt(per)} · ${ct.toFixed(2)}초 · 초당 ${fmt(per / ct)}`
        : `1회 ${fmt(u.udef.baseOutput * def.outScale)} · ${u.udef.cycleTime}초`;

      const ratio = state.running ? Math.min(1, state.progress / ct) : 0;
      u.barFill.style.width = `${ratio * 100}%`;
      u.barText.textContent = owned ? (auto ? '자동' : state.running ? `${Math.max(0, ct - state.progress).toFixed(1)}초` : '탭하여 가동') : '';

      const ms = nextMilestone(state.level);
      u.msEl.textContent =
        owned && ms
          ? `다음 보너스 Lv.${ms.level} — ${ms.type === 'output' ? '산출' : '속도'} x${ms.factor} (${ms.level - state.level} 남음)`
          : owned
            ? '모든 보너스 달성'
            : '';

      const count = game.buyMode === 'max' ? Math.max(1, unitMaxAffordable(st, def, u.i)) : game.buyMode;
      const cost = unitCost(st, def, u.i, count);
      const affordable = st.resources.cash >= cost;
      u.buyBtn.className = affordable ? 'primary' : '';
      u.buyBtn.innerHTML = '';
      u.buyBtn.append(
        owned ? `+${game.buyMode === 'max' ? formatInt(count) : count}` : '건설',
        h('span', { class: 'btn-sub' }, fmt(cost)),
      );

      if (state.manager) {
        u.mgrBtn.className = 'ghost';
        u.mgrBtn.disabled = true;
        u.mgrBtn.innerHTML = '';
        u.mgrBtn.append('👤 ', h('span', { class: 'btn-sub' }, u.udef.managerName));
      } else if (!owned) {
        u.mgrBtn.style.display = 'none';
      } else {
        u.mgrBtn.style.display = '';
        const mcost = managerCost(def, u.i);
        u.mgrBtn.className = st.resources.cash >= mcost ? 'gold' : '';
        u.mgrBtn.disabled = false;
        u.mgrBtn.innerHTML = '';
        u.mgrBtn.append('매니저', h('span', { class: 'btn-sub' }, fmt(mcost)));
      }
    }
  }

  update();
  return { root, update };
}

function floaty(anchor: HTMLElement, text: string): void {
  const rect = anchor.getBoundingClientRect();
  const el = h('div', { class: 'floaty', style: { left: `${rect.left + 10}px`, top: `${rect.top}px` } }, text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
