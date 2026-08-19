import { CONFIG } from '../data/config';
import { RESOURCE_META } from '../data/businesses';
import { HOIST_LEVELS, EQUIPMENT, equipmentTier, workerCount } from '../data/units';
import {
  automationStage,
  autoFactor,
  businessRatePerSecond,
  chainActive,
  cycleTime,
  equipCost,
  hoistCost,
  hoistGemCost,
  hoistMult,
  isBoosted,
  managerCost,
  minigameMultiplier,
  nextMilestone,
  outputPerCycle,
  projectedEfficiency,
  staffed,
  unitCost,
  unitMaxAffordable,
  unitUnlockCost,
} from '../core/economy';
import { formatClock, formatInt, formatNumber } from '../core/num';
import type { Game, BuyMode } from '../core/game';
import type { BusinessId } from '../core/types';
import { h, haptic } from './dom';
import { showCashDropSheet } from './modals';
import { fit } from './scene/iso';
import { drawSpriteFlat } from './art/assets';
import { drawFloorStrip } from './scene/floorStrip';

const BUY_MODES: BuyMode[] = [1, 10, 100, 'max'];
const STAGE_LABEL = ['', '수동', '반자동 50%', '자동 100%', '고효율'];

export interface View {
  root: HTMLElement;
  update: () => void;
  draw?: (t: number) => void;
}

export function createBusinessView(game: Game, id: BusinessId): View {
  const def = game.def(id);
  const fmt = (v: number) => formatNumber(v, game.state.settings.notation);

  // ── 지상부 ──
  const rateEl = h('b', { class: 'surface-rate' }, '');
  const stockEl = h('span', { class: 'chip' }, '');
  const boostChip = h('span', { class: 'chip on', style: { display: 'none' } }, '');
  const hoistTitle = h('div', { class: 'hoist-title' }, '');
  const hoistDesc = h('div', { class: 'small muted' }, '');
  const hoistBtn = h('button', { class: 'buy' }, '');
  hoistBtn.addEventListener('click', () => {
    if (!game.buyHoist(id)) game.toast('자금 또는 보석이 모자랍니다');
    else haptic(game.state.settings.haptics);
  });

  const mgBtn = h('button', { class: 'primary grow' }, '');
  mgBtn.addEventListener('click', async () => {
    haptic(game.state.settings.haptics);
    const r = await game.playMinigame(id);
    if (r) game.toast(`성공률 ${Math.round(r.rate * 100)}% · 배율 x${r.mult.toFixed(2)}`);
  });
  const boostBtn = h('button', { class: 'ad grow' }, '');
  boostBtn.addEventListener('click', async () => {
    haptic(game.state.settings.haptics);
    await game.adBoost(id);
  });

  const surface = h(
    'div',
    { class: 'surface', style: { borderColor: def.color } },
    h(
      'div',
      { class: 'row spread' },
      h('div', null, h('div', { class: 'surface-name' }, `${def.icon} ${def.name}`), h('div', { class: 'small muted' }, def.subtitle)),
      h('div', { class: 'center' }, rateEl, h('div', { class: 'small muted' }, '초당')),
    ),
    h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'wrap', gap: '6px' } }, stockEl, boostChip),
    h(
      'div',
      { class: 'hoist' },
      h('div', { class: 'grow' }, hoistTitle, hoistDesc),
      hoistBtn,
    ),
    h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, mgBtn, boostBtn),
  );

  // ── 층 ──
  const floors = def.units.map((udef, i) => {
    const canvas = h('canvas', { class: 'floor-art' });
    const nameEl = h('b', { class: 'floor-name' }, udef.name);
    const lvEl = h('span', { class: 'floor-lv' }, '');
    const metaEl = h('div', { class: 'floor-meta' }, '');
    const progFill = h('i', { style: { width: '0%' } });
    const buyBtn = h('button', { class: 'buy' }, '');
    const autoBtn = h('button', { class: 'auto' }, '');
    const lockBtn = h('button', { class: 'gold lock-btn' }, '');

    buyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const u = game.state.businesses[id].units[i];
      const count = game.buyMode === 'max' ? unitMaxAffordable(game.state, def, i) : game.buyMode;
      const cost = u.unlocked ? unitCost(game.state, def, i, Math.max(1, count)) : unitUnlockCost(def, i);
      if (game.state.resources.cash < cost) return showCashDropSheet(game);
      if (game.buyUnit(id, i)) haptic(game.state.settings.haptics);
    });
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (game.state.resources.cash < unitUnlockCost(def, i)) return showCashDropSheet(game);
      game.unlockUnit(id, i);
    });
    autoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const u = game.state.businesses[id].units[i];
      if (u.manager) return;
      const cost = u.equip ? managerCost(def, i) : equipCost(def, i);
      if (game.state.resources.cash < cost) return showCashDropSheet(game);
      if (u.equip) game.buyManager(id, i);
      else game.buyEquip(id, i);
    });

    const row = h(
      'div',
      {
        class: 'floor',
        onclick: () => {
          if (game.tapUnit(id, i)) haptic(game.state.settings.haptics);
        },
      },
      canvas,
      h('div', { class: 'floor-scrim' }),
      h('div', { class: 'floor-info' }, h('div', { class: 'floor-title' }, nameEl, lvEl), metaEl),
      h('div', { class: 'floor-actions' }, buyBtn, autoBtn),
      lockBtn,
      h('div', { class: 'floor-progress' }, progFill),
    );
    return { row, canvas, nameEl, lvEl, metaEl, progFill, buyBtn, autoBtn, lockBtn, udef, i };
  });

  // ── 구매 단위 ──
  const segButtons = BUY_MODES.map((m) =>
    h(
      'button',
      {
        class: game.buyMode === m ? 'on' : '',
        onclick: () => {
          game.buyMode = m;
          segButtons.forEach((b, k) => b.classList.toggle('on', BUY_MODES[k] === m));
          update();
        },
      },
      m === 'max' ? '최대' : `x${m}`,
    ),
  );
  const buyBar = h('div', { class: 'buybar' }, ...segButtons);

  const root = h('div', { class: 'biz' }, surface, h('div', { class: 'floors' }, ...floors.map((f) => f.row)), buyBar);

  function draw(t: number): void {
    const st = game.state;
    const now = Date.now();
    const bs = st.businesses[id];
    const staff = staffed(st, id);
    for (const f of floors) {
      const u = bs.units[f.i];
      const w = f.row.clientWidth;
      const hh = f.row.clientHeight;
      if (w <= 0 || hh <= 0) continue;
      const ct = cycleTime(st, def, f.i);
      const p = u.running ? Math.min(1, u.progress / ct) : 0;
      const fctx = fit(f.canvas, w, hh);
      drawFloorStrip({
        ctx: fctx,
        w,
        h: hh,
        biz: id,
        color: def.color,
        index: f.i,
        level: u.level,
        unlocked: u.unlocked,
        p,
        running: u.running,
        auto: autoFactor(st, id, f.i, now) > 0,
        idle: u.unlocked && f.i >= staff,
        t,
        sprite: (key, x, y, hgt) => drawSpriteFlat(fctx, key, x, y, hgt),
      });
      f.progFill.style.width = `${p * 100}%`;
    }
  }

  function update(): void {
    const st = game.state;
    const now = Date.now();
    const bs = st.businesses[id];
    const eff = projectedEfficiency(st, def, now);
    const rate = businessRatePerSecond(st, def, now);
    const staff = staffed(st, id);

    rateEl.textContent = fmt(rate.cash * eff);

    const meta = RESOURCE_META[def.output];
    if (def.input && chainActive(st)) {
      const inMeta = RESOURCE_META[def.input.resource];
      const pct = Math.round(eff * 100);
      stockEl.textContent = `가동률 ${pct}% · ${inMeta.icon} ${fmt(st.resources[def.input.resource])}`;
      stockEl.className = `chip ${pct >= 95 ? 'on' : 'warn'}`;
    } else if (def.output !== 'cash') {
      stockEl.textContent = `${meta.icon} ${meta.name} ${fmt(st.resources[def.output])}`;
      stockEl.className = 'chip';
    } else {
      stockEl.textContent = `누적 매출 ${fmt(bs.totalProduced)}`;
      stockEl.className = 'chip';
    }

    const mgMult = minigameMultiplier(st, id, now);
    if (isBoosted(st, id, now)) {
      boostChip.style.display = '';
      boostChip.textContent = `⚡ ${CONFIG.ads.boostFactor}배 ${formatClock((bs.boostUntil - now) / 1000)}`;
    } else if (mgMult > 1) {
      boostChip.style.display = '';
      boostChip.textContent = `🎮 x${mgMult} ${formatClock((st.minigames[id].boostUntil - now) / 1000)}`;
    } else boostChip.style.display = 'none';

    // 엘리베이터
    const hl = bs.hoistLevel;
    hoistTitle.textContent = `${def.hoistIcon} ${def.hoistName} Lv.${hl}`;
    const maxed = hl >= HOIST_LEVELS.length;
    hoistDesc.textContent = maxed
      ? `전 ${def.unitLabel} 산출 x${hoistMult(st, id)} (최대)`
      : `전 ${def.unitLabel} 산출 x${hoistMult(st, id)} → x${HOIST_LEVELS[hl].mult}`;
    const hc = hoistCost(st, id);
    const hg = hoistGemCost(st, id);
    hoistBtn.disabled = maxed;
    hoistBtn.innerHTML = '';
    if (maxed) hoistBtn.append('MAX');
    else {
      hoistBtn.className = `buy ${st.resources.cash >= hc && st.resources.gem >= hg ? '' : 'dim'}`;
      hoistBtn.append('올리기', h('span', { class: 'btn-sub' }, hg > 0 ? `💰${fmt(hc)} · 💎${hg}` : `💰${fmt(hc)}`));
    }

    const left = game.minigamePlaysLeft(id);
    const adLeft = game.minigameAdPlaysLeft(id);
    mgBtn.innerHTML = '';
    mgBtn.className = left > 0 ? 'primary grow' : adLeft > 0 ? 'ad grow' : 'grow';
    mgBtn.disabled = left <= 0 && adLeft <= 0;
    mgBtn.append('▶ 미니게임', h('span', { class: 'btn-sub' }, left > 0 ? `무료 ${left}회` : adLeft > 0 ? `광고 +1 (${adLeft})` : '내일 다시'));
    boostBtn.disabled = !game.ads.isAvailable('tabBoost');
    boostBtn.innerHTML = '';
    boostBtn.append(`⚡ ${CONFIG.ads.boostFactor}배`, h('span', { class: 'btn-sub' }, `광고 ${Math.round(CONFIG.ads.boostSeconds / 60)}분`));

    for (const f of floors) {
      const u = bs.units[f.i];
      f.row.classList.toggle('locked', !u.unlocked);
      const auto = autoFactor(st, id, f.i, now) > 0;
      const idle = u.unlocked && f.i >= staff;
      f.row.classList.toggle('tappable', u.unlocked && !auto && !u.running && !idle);
      f.row.classList.toggle('idle', idle);

      if (!u.unlocked) {
        f.lockBtn.style.display = '';
        f.buyBtn.style.display = 'none';
        f.autoBtn.style.display = 'none';
        const cost = unitUnlockCost(def, f.i);
        f.lockBtn.className = `lock-btn ${st.resources.cash >= cost ? 'gold' : ''}`;
        f.lockBtn.innerHTML = '';
        f.lockBtn.append('🔒 해금', h('span', { class: 'btn-sub' }, fmt(cost)));
        f.lvEl.textContent = '미개발';
        f.metaEl.textContent = `1회 ${fmt(f.udef.baseOutput)} · ${f.udef.cycleTime}초`;
        continue;
      }

      f.lockBtn.style.display = 'none';
      f.buyBtn.style.display = '';
      f.autoBtn.style.display = '';
      f.lvEl.textContent = `Lv.${formatInt(u.level)}`;

      const ct = cycleTime(st, def, f.i);
      const per = outputPerCycle(st, def, f.i, now) * eff;
      const ms = nextMilestone(u.level);
      const equip = EQUIPMENT[id]?.[equipmentTier(u.level)] ?? '';
      f.metaEl.textContent = idle
        ? '인구 부족으로 정지'
        : `초당 ${fmt(per / ct)} · ${equip} · 인력 ${workerCount(u.level)}명 · ${STAGE_LABEL[automationStage(st, id, f.i)]}` +
          (ms ? ` · Lv.${ms} 산출x2` : '');

      const count = game.buyMode === 'max' ? Math.max(1, unitMaxAffordable(st, def, f.i)) : game.buyMode;
      const cost = unitCost(st, def, f.i, count);
      f.buyBtn.className = `buy ${st.resources.cash >= cost ? '' : 'dim'}`;
      f.buyBtn.innerHTML = '';
      f.buyBtn.append(`Lv +${game.buyMode === 'max' ? formatInt(count) : count}`, h('span', { class: 'btn-sub' }, fmt(cost)));

      if (u.manager) {
        f.autoBtn.className = 'auto hired';
        f.autoBtn.disabled = true;
        f.autoBtn.innerHTML = '';
        f.autoBtn.append('👤', h('span', { class: 'btn-sub' }, f.udef.managerName));
      } else if (u.equip) {
        const mc = managerCost(def, f.i);
        f.autoBtn.className = `auto ${st.resources.cash >= mc ? 'gold' : 'dim'}`;
        f.autoBtn.disabled = false;
        f.autoBtn.innerHTML = '';
        f.autoBtn.append('매니저', h('span', { class: 'btn-sub' }, fmt(mc)));
      } else {
        const ec = equipCost(def, f.i);
        f.autoBtn.className = `auto ${st.resources.cash >= ec ? '' : 'dim'}`;
        f.autoBtn.disabled = false;
        f.autoBtn.innerHTML = '';
        f.autoBtn.append('설비 50%', h('span', { class: 'btn-sub' }, fmt(ec)));
      }
    }
  }

  update();
  return { root, update, draw };
}
