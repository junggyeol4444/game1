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
import { fitCanvas } from './scene/gfx';
import { BAND_PAINTERS, crewCount } from './scene/bands';
import { SITE_PAINTERS } from './scene/site';

const BUY_MODES: BuyMode[] = [1, 10, 100, 'max'];

export interface View {
  root: HTMLElement;
  update: () => void;
  draw?: (t: number) => void;
}

export function createBusinessView(game: Game, id: BusinessId): View {
  const def = game.def(id);
  const fmt = (v: number) => formatNumber(v, game.state.settings.notation);

  // ── 사업장 전경 ──────────────────────────────────────────────
  const siteCanvas = h('canvas', { class: 'site-art' });
  const siteName = h('div', { class: 'site-name' }, `${def.icon} ${def.name}`);
  const siteRate = h('div', { class: 'site-rate' }, '');
  const effChip = h('span', { class: 'chip' }, '');
  const boostChip = h('span', { class: 'chip on', style: { display: 'none' } }, '');

  const boostBtn = h(
    'button',
    {
      class: 'ad',
      onclick: async () => {
        haptic(game.state.settings.haptics);
        await game.adBoost(id);
      },
    },
    `⚡ ${CONFIG.ads.boostFactor}배`,
    h('span', { class: 'btn-sub' }, `광고 ${Math.round(CONFIG.ads.boostSeconds / 60)}분`),
  );
  const trialBtn = h(
    'button',
    {
      class: 'ad',
      onclick: async () => {
        haptic(game.state.settings.haptics);
        await game.adTrialManager(id);
      },
    },
    '👷 임시 매니저',
    h('span', { class: 'btn-sub' }, `광고 ${Math.round(CONFIG.ads.trialManagerSeconds / 60)}분 자동`),
  );

  const site = h(
    'div',
    { class: 'site', style: { borderColor: def.color } },
    siteCanvas,
    h('div', { class: 'site-top' }, siteName, siteRate),
    h('div', { class: 'site-chips' }, effChip, boostChip),
    h('div', { class: 'site-actions' }, boostBtn, trialBtn),
  );

  // ── 구매 단위 ────────────────────────────────────────────────
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
  const seg = h('div', { class: 'seg buymode' }, ...segButtons);

  // ── 유닛 밴드 ────────────────────────────────────────────────
  const bands = def.units.map((udef, i) => {
    const canvas = h('canvas', { class: 'band-art' });
    const nameEl = h('div', { class: 'band-name' }, udef.name);
    const lvEl = h('span', { class: 'band-lv' }, '');
    const metaEl = h('div', { class: 'band-meta' }, '');
    const hintEl = h('div', { class: 'band-hint' }, '탭하여 가동');
    const progFill = h('i', { style: { width: '0%' } });
    const buyBtn = h('button', { class: 'band-buy' }, '');
    const mgrBtn = h('button', { class: 'band-mgr' }, '');

    buyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const count = game.buyMode === 'max' ? unitMaxAffordable(game.state, def, i) : game.buyMode;
      const cost = unitCost(game.state, def, i, Math.max(1, count));
      if (game.state.resources.cash < cost) return showCashDropSheet(game);
      if (game.buyUnit(id, i)) {
        haptic(game.state.settings.haptics);
        floaty(buyBtn, `Lv +${game.buyMode === 'max' ? formatInt(Math.max(1, count)) : count}`);
      }
    });

    mgrBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (game.state.resources.cash < managerCost(def, i)) return showCashDropSheet(game);
      game.buyManager(id, i);
    });

    const band = h(
      'div',
      {
        class: 'band',
        onclick: () => {
          if (game.tapUnit(id, i)) haptic(game.state.settings.haptics);
        },
      },
      canvas,
      h('div', { class: 'band-scrim' }),
      h('div', { class: 'band-info' }, h('div', { class: 'band-title' }, nameEl, lvEl), metaEl),
      hintEl,
      h('div', { class: 'band-actions' }, buyBtn, mgrBtn),
      h('div', { class: 'band-progress' }, progFill),
    );

    return { band, canvas, nameEl, lvEl, metaEl, hintEl, progFill, buyBtn, mgrBtn, udef, i };
  });

  const root = h('div', { class: 'biz' }, site, seg, ...bands.map((b) => b.band));

  // ── 그리기 (매 프레임) ───────────────────────────────────────
  function draw(t: number): void {
    const st = game.state;
    const now = Date.now();
    const eff = projectedEfficiency(st, def, now);
    const bs = st.businesses[id];

    const sw = site.clientWidth;
    const sh = site.clientHeight;
    if (sw > 0 && sh > 0) {
      const owned = bs.units.filter((u) => u.level > 0).length;
      const lv = bs.units.reduce((a, u) => a + u.level, 0);
      const dev = Math.min(1, (owned / def.units.length) * 0.5 + Math.min(1, Math.log10(lv + 1) / 3) * 0.5);
      SITE_PAINTERS[id]({
        ctx: fitCanvas(siteCanvas, sw, sh),
        w: sw,
        h: sh,
        t,
        dev,
        boosted: isBoosted(st, id, now),
        eff,
      });
    }

    const paint = BAND_PAINTERS[id];
    for (const b of bands) {
      const u = bs.units[b.i];
      const bw = b.band.clientWidth;
      const bh = b.band.clientHeight;
      if (bw <= 0 || bh <= 0) continue;
      const ct = cycleTime(st, def, b.i);
      const p = u.running ? Math.min(1, u.progress / ct) : 0;
      paint({
        ctx: fitCanvas(b.canvas, bw, bh),
        w: bw,
        h: bh,
        index: b.i,
        level: u.level,
        owned: u.level > 0,
        p,
        running: u.running,
        auto: isAutomated(st, id, b.i, now),
        boosted: isBoosted(st, id, now),
        eff,
        t,
      });
      b.progFill.style.width = `${p * 100}%`;
    }
  }

  // ── 텍스트/버튼 갱신 (10Hz) ──────────────────────────────────
  function update(): void {
    const st = game.state;
    const now = Date.now();
    const bs = st.businesses[id];
    const eff = projectedEfficiency(st, def, now);
    const rate = businessRatePerSecond(st, def, now);

    siteRate.innerHTML = '';
    siteRate.append(fmt(rate.cash * eff), h('small', null, '/초'));

    const meta = RESOURCE_META[def.output];
    if (def.input && chainActive(st)) {
      const inMeta = RESOURCE_META[def.input.resource];
      const pct = Math.round(eff * 100);
      effChip.textContent = `가동률 ${pct}% · ${inMeta.icon} ${fmt(st.resources[def.input.resource])}`;
      effChip.className = `chip ${pct >= 95 ? 'on' : 'warn'}`;
    } else if (def.output !== 'cash') {
      effChip.textContent = `${meta.icon} ${meta.name} ${fmt(st.resources[def.output])}`;
      effChip.className = 'chip';
    } else {
      effChip.textContent = `누적 매출 ${fmt(bs.totalProduced)}`;
      effChip.className = 'chip';
    }

    if (isBoosted(st, id, now)) {
      boostChip.style.display = '';
      boostChip.textContent = `⚡ ${CONFIG.ads.boostFactor}배 ${formatClock((bs.boostUntil - now) / 1000)}`;
    } else boostChip.style.display = 'none';

    boostBtn.disabled = !game.ads.isAvailable('tabBoost');
    const allManaged = bs.units.every((u) => u.level <= 0 || u.manager);
    trialBtn.style.display = allManaged ? 'none' : '';
    trialBtn.disabled = !game.ads.isAvailable('trialManager') || bs.trialUntil > now;

    for (const b of bands) {
      const u = bs.units[b.i];
      const owned = u.level > 0;
      const auto = isAutomated(st, id, b.i, now);
      b.band.classList.toggle('locked', !owned);
      b.band.classList.toggle('tappable', owned && !auto && !u.running);

      b.lvEl.textContent = owned ? `Lv.${formatInt(u.level)}` : '미개발';
      b.hintEl.style.display = owned && !auto && !u.running ? '' : 'none';

      const ct = cycleTime(st, def, b.i);
      const per = outputPerCycle(st, def, b.i, now) * eff;
      const ms = nextMilestone(u.level);
      b.metaEl.textContent = owned
        ? `초당 ${fmt(per / ct)} · 인력 ${crewCount(u.level)}명` +
          (ms ? ` · Lv.${ms.level}에 ${ms.type === 'output' ? '산출' : '속도'} x${ms.factor}` : ' · 보너스 전부 달성')
        : `1회 ${fmt(b.udef.baseOutput * def.outScale)} · ${b.udef.cycleTime}초`;

      const count = game.buyMode === 'max' ? Math.max(1, unitMaxAffordable(st, def, b.i)) : game.buyMode;
      const cost = unitCost(st, def, b.i, count);
      const canBuy = st.resources.cash >= cost;
      b.buyBtn.className = `band-buy ${canBuy ? 'primary' : ''}`;
      b.buyBtn.innerHTML = '';
      b.buyBtn.append(
        owned ? `Lv +${game.buyMode === 'max' ? formatInt(count) : count}` : '개발하기',
        h('span', { class: 'btn-sub' }, fmt(cost)),
      );

      if (!owned) {
        b.mgrBtn.style.display = 'none';
      } else if (u.manager) {
        b.mgrBtn.style.display = '';
        b.mgrBtn.className = 'band-mgr hired';
        b.mgrBtn.disabled = true;
        b.mgrBtn.innerHTML = '';
        b.mgrBtn.append('👤', h('span', { class: 'btn-sub' }, b.udef.managerName));
      } else {
        b.mgrBtn.style.display = '';
        const mcost = managerCost(def, b.i);
        b.mgrBtn.className = `band-mgr ${st.resources.cash >= mcost ? 'gold' : ''}`;
        b.mgrBtn.disabled = false;
        b.mgrBtn.innerHTML = '';
        b.mgrBtn.append('매니저', h('span', { class: 'btn-sub' }, fmt(mcost)));
      }
    }
  }

  update();
  return { root, update, draw };
}

function floaty(anchor: HTMLElement, text: string): void {
  const rect = anchor.getBoundingClientRect();
  const el = h('div', { class: 'floaty', style: { left: `${rect.left}px`, top: `${rect.top}px` } }, text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
