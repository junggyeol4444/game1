import { FACILITY_BY_ID, TIER_THRESHOLDS, tierOf, type FacilityId } from '../data/buildings';
import { formatInt, formatNumber } from '../core/num';
import {
  buildPrice,
  canAfford,
  cityStats,
  facilityTotalLevel,
  isBuilt,
  trackLevel,
  trackPrice,
} from '../core/facilities';
import type { Game } from '../core/game';
import { h, haptic } from './dom';
import { fitCanvas } from './scene/gfx';
import { FACILITY_SCENES } from './scene/facilityScenes';
import type { View } from './businessView';

export function createFacilityView(game: Game, id: FacilityId): View {
  const def = FACILITY_BY_ID[id];
  const fmt = (v: number) => formatNumber(v, game.state.settings.notation);

  const canvas = h('canvas', { class: 'site-art' });
  const nameEl = h('div', { class: 'site-name' }, `${def.icon} ${def.name}`);
  const tierEl = h('div', { class: 'site-rate small' }, '');
  const effChip = h('span', { class: 'chip' }, def.effect);
  const site = h(
    'div',
    { class: 'site', style: { borderColor: def.color } },
    canvas,
    h('div', { class: 'site-top' }, nameEl, tierEl),
    h('div', { class: 'site-chips' }, effChip),
  );

  // 건설 전
  const buildBtn = h('button', { class: 'gold wide' }, '');
  const buildCard = h(
    'div',
    { class: 'card center' },
    h('div', { style: { fontSize: '34px' } }, def.icon),
    h('div', { style: { fontWeight: '800', marginTop: '4px' } }, `${def.name} 건설`),
    h('div', { class: 'small muted', style: { margin: '6px 0 10px' } }, def.seeing),
    buildBtn,
  );
  buildBtn.addEventListener('click', () => {
    if (game.buildFacility(id)) {
      haptic(game.state.settings.haptics);
      game.toast(`${def.name} 건설 완료`);
    }
  });

  // 업그레이드 / 현황 전환
  let tab: 'up' | 'status' = 'up';
  const tabUp = h('button', { class: 'on' }, '업그레이드');
  const tabStatus = h('button', null, '현황');
  const seg = h('div', { class: 'seg buymode' }, tabUp, tabStatus);
  tabUp.addEventListener('click', () => {
    tab = 'up';
    tabUp.classList.add('on');
    tabStatus.classList.remove('on');
    update();
  });
  tabStatus.addEventListener('click', () => {
    tab = 'status';
    tabStatus.classList.add('on');
    tabUp.classList.remove('on');
    update();
  });

  const trackRows = def.tracks.map((tr) => {
    const lvEl = h('span', { class: 'band-lv' }, '');
    const nowEl = h('div', { class: 'small muted' }, '');
    const nextEl = h('div', { class: 'small good' }, '');
    const btn = h('button', { class: 'primary' }, '');
    btn.addEventListener('click', () => {
      if (game.buyFacilityTrack(id, tr.id)) haptic(game.state.settings.haptics);
    });
    const row = h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'row' },
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'band-title' }, h('b', null, tr.name), lvEl),
          nowEl,
          nextEl,
        ),
        btn,
      ),
    );
    return { row, lvEl, nowEl, nextEl, btn, tr };
  });

  const upPanel = h('div', null, ...trackRows.map((r) => r.row));
  const statusPanel = h('div', { class: 'card' });
  const panelHost = h('div', null, upPanel, statusPanel);

  const root = h('div', { class: 'biz' }, site, buildCard, seg, panelHost);

  function draw(t: number): void {
    const w = site.clientWidth;
    const hh = site.clientHeight;
    if (w <= 0 || hh <= 0) return;
    const st = game.state;
    const total = facilityTotalLevel(st, id);
    const tier = isBuilt(st, id) ? Math.max(1, tierOf(total)) : 0;
    const cs = cityStats(st);
    const strained =
      (id === 'power' && cs.powerEff < 0.999) ||
      (id === 'housing' && cs.laborEff < 0.999) ||
      (id === 'fire' && st.events.some((e) => e.kind === 'fire' && e.until > Date.now()));
    FACILITY_SCENES[id]({
      ctx: fitCanvas(canvas, w, hh),
      w,
      h: hh,
      t,
      dev: Math.min(1, total / 60),
      tier,
      strained,
    });
  }

  function statusRow(label: string, value: string, tone = ''): HTMLElement {
    return h(
      'div',
      { class: 'row spread', style: { padding: '4px 0' } },
      h('span', { class: 'muted' }, label),
      h('b', { class: tone }, value),
    );
  }

  function update(): void {
    const st = game.state;
    const built = isBuilt(st, id);
    const total = facilityTotalLevel(st, id);
    const tier = built ? Math.max(1, tierOf(total)) : 0;
    const cs = cityStats(st);

    buildCard.style.display = built ? 'none' : '';
    seg.style.display = built ? '' : 'none';
    panelHost.style.display = built ? '' : 'none';
    upPanel.style.display = built && tab === 'up' ? '' : 'none';
    statusPanel.style.display = built && tab === 'status' ? '' : 'none';

    tierEl.textContent = built ? `${def.tiers[tier]} · 총 Lv.${formatInt(total)}` : '미건설';

    if (!built) {
      const p = buildPrice(id);
      const ok = canAfford(st, p);
      buildBtn.className = `wide ${ok ? 'gold' : ''}`;
      buildBtn.disabled = !ok;
      buildBtn.innerHTML = '';
      buildBtn.append('건설하기', h('span', { class: 'btn-sub' }, `💰 ${fmt(p.cash)} · 📦 ${fmt(p.material)}`));
      return;
    }

    for (const r of trackRows) {
      const lv = trackLevel(st, id, r.tr.id);
      const p = trackPrice(st, id, r.tr.id);
      const maxed = lv >= r.tr.maxLevel;
      const ok = canAfford(st, p);
      r.lvEl.textContent = `Lv.${formatInt(lv)}${maxed ? ' MAX' : ''}`;
      r.nowEl.textContent = r.tr.effect(lv);
      r.nextEl.textContent = maxed ? '' : `→ ${r.tr.effect(lv + 1)}`;
      r.btn.className = maxed ? '' : ok ? 'primary' : '';
      r.btn.disabled = maxed;
      r.btn.innerHTML = '';
      if (maxed) r.btn.append('MAX');
      else r.btn.append('올리기', h('span', { class: 'btn-sub' }, `💰${fmt(p.cash)} · 📦${fmt(p.material)}`));
    }

    // 현황
    statusPanel.innerHTML = '';
    statusPanel.append(h('h3', null, '현황'));
    const nextTier = TIER_THRESHOLDS.find((v) => v > total);
    statusPanel.append(statusRow('현재 외형', def.tiers[tier]));
    if (nextTier !== undefined) {
      statusPanel.append(
        statusRow('다음 외형', `${def.tiers[Math.min(def.tiers.length - 1, tier + 1)]} (총 Lv.${nextTier})`, 'gold'),
      );
    }
    if (id === 'power') {
      statusPanel.append(statusRow('전력 공급', fmt(cs.powerSupply)));
      statusPanel.append(statusRow('전력 수요', fmt(cs.powerDemand), cs.powerEff < 1 ? 'bad' : ''));
      statusPanel.append(statusRow('사업 가동률', `${Math.round(cs.powerEff * 100)}%`, cs.powerEff < 1 ? 'bad' : 'good'));
    } else if (id === 'housing') {
      statusPanel.append(statusRow('인구', formatInt(st.city.pop)));
      statusPanel.append(statusRow('인구 상한', formatInt(cs.popCap)));
      statusPanel.append(statusRow('노동력 공급', fmt(cs.laborSupply)));
      statusPanel.append(statusRow('노동력 수요', fmt(cs.laborDemand), cs.laborEff < 1 ? 'bad' : ''));
      statusPanel.append(statusRow('사업 가동률', `${Math.round(cs.laborEff * 100)}%`, cs.laborEff < 1 ? 'bad' : 'good'));
    } else if (id === 'school') {
      statusPanel.append(statusRow('전 사업 산출', `x${cs.outputMult.toFixed(2)}`, 'good'));
    } else if (id === 'shops') {
      statusPanel.append(statusRow('세수 배율', `x${cs.taxMult.toFixed(2)}`, 'good'));
    } else if (id === 'hospital') {
      statusPanel.append(statusRow('노동력 공급', fmt(cs.laborSupply), 'good'));
    } else if (id === 'green') {
      statusPanel.append(statusRow('인구 유입', `초당 ${cs.popGrowthPerSec.toFixed(2)}명`, 'good'));
      statusPanel.append(statusRow('현재 인구', formatInt(st.city.pop)));
    } else if (id === 'road') {
      statusPanel.append(statusRow('최소 가동률', `+${Math.round(cs.chainFloorBonus * 100)}%p`, 'good'));
      statusPanel.append(statusRow('사슬 요구량', `x${cs.chainDemandMult.toFixed(2)}`, 'good'));
      statusPanel.append(statusRow('오프라인 효율', `+${Math.round(cs.offlineBonus * 100)}%p`, 'good'));
    } else if (id === 'fire') {
      statusPanel.append(statusRow('화재 확률', `x${cs.fireChanceMult.toFixed(2)}`, 'good'));
      statusPanel.append(statusRow('진압 시간', `x${cs.fireDurationMult.toFixed(2)}`, 'good'));
      statusPanel.append(statusRow('피해량', `x${cs.fireDamageMult.toFixed(2)}`, 'good'));
    } else if (id === 'police') {
      statusPanel.append(statusRow('도난 확률', `x${cs.theftChanceMult.toFixed(2)}`, 'good'));
      statusPanel.append(statusRow('손실액', `x${cs.theftLossMult.toFixed(2)}`, 'good'));
      statusPanel.append(statusRow('차단 확률', `${Math.round(cs.theftBlockChance * 100)}%`, 'good'));
    }
    statusPanel.append(h('div', { class: 'small muted', style: { marginTop: '8px' } }, def.seeing));
  }

  update();
  return { root, update, draw };
}
