import { FACILITY_BY_ID, FAC_TIER_LEVELS, facilityTierOf, type FacilityId } from '../data/buildings';
import { formatInt, formatNumber } from '../core/num';
import { cityStats, facilityCost, facilityLevel } from '../core/facilities';
import { offlineCapSeconds, offlineRate } from '../core/economy';
import { formatDuration } from '../core/num';
import type { Game } from '../core/game';
import { h, haptic } from './dom';
import { TH, TW, fit, type Cam } from './scene/iso';
import { drawSprite, placeholder } from './art/assets';
import { buildingKey } from './art/keys';
import type { View } from './businessView';

export function createFacilityView(game: Game, id: FacilityId): View {
  const def = FACILITY_BY_ID[id];
  const fmt = (v: number) => formatNumber(v, game.state.settings.notation);

  const canvas = h('canvas', { class: 'fac-art' });
  const tierEl = h('div', { class: 'fac-tier' }, '');
  const stage = h('div', { class: 'fac-stage' }, canvas, tierEl);

  const lvEl = h('div', { class: 'fac-lv' }, '');
  const effNow = h('div', { class: 'fac-eff' }, '');
  const effNext = h('div', { class: 'small good' }, '');
  const upBtn = h('button', { class: 'buy wide' }, '');
  upBtn.addEventListener('click', () => {
    if (game.buyFacility(id)) haptic(game.state.settings.haptics);
  });
  const upCard = h('div', { class: 'card' }, lvEl, effNow, effNext, upBtn);

  const statusCard = h('div', { class: 'card' });
  const root = h('div', { class: 'biz' }, stage, upCard, statusCard);

  const cam: Cam = { x: 0, y: 0, zoom: 1, w: 1, h: 1 };

  function draw(_t: number): void {
    const w = stage.clientWidth;
    const hh = stage.clientHeight;
    if (w <= 0 || hh <= 0) return;
    const ctx = fit(canvas, w, hh);
    const st = game.state;
    const level = facilityLevel(st, id);
    const tier = facilityTierOf(level);
    const hour = new Date().getHours();
    const night = hour >= 19 || hour < 6;
    void night;

    // 하늘 + 지면
    const g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, night ? '#2E4A66' : '#BFE8F2');
    g.addColorStop(1, night ? '#4E6C88' : '#9FD8E8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hh);

    cam.w = w;
    cam.h = hh;
    cam.zoom = Math.min(w / (4.2 * TW), hh / (3.4 * TH + 90));
    cam.x = 0;
    cam.y = 2 * TH + 20;
    if (tier === 0) return;
    const key = buildingKey(id, tier);
    if (!drawSprite(ctx, cam, key, -1, -1, 2, 2)) placeholder(ctx, cam, key, -1, -1, 2, 2, def.name);
  }

  function row(label: string, value: string, tone = ''): HTMLElement {
    return h(
      'div',
      { class: 'row spread', style: { padding: '4px 0' } },
      h('span', { class: 'muted' }, label),
      h('b', { class: tone }, value),
    );
  }

  function update(): void {
    const st = game.state;
    const level = facilityLevel(st, id);
    const tier = facilityTierOf(level);
    const cs = cityStats(st);
    const cost = facilityCost(st, id);
    const maxed = level >= def.maxLevel;

    tierEl.textContent = `${def.icon} ${def.name} · ${def.tiers[tier]}`;
    lvEl.innerHTML = '';
    lvEl.append(h('b', null, level > 0 ? `Lv.${formatInt(level)}` : '미건설'), h('span', { class: 'small muted' }, ` / ${def.effect}`));
    effNow.textContent = def.effectText(level);
    effNext.textContent = maxed ? '최대치 도달' : `→ ${def.effectText(level + 1)}`;
    upBtn.className = `wide ${maxed ? '' : st.resources.cash >= cost ? 'buy' : 'dim'}`;
    upBtn.disabled = maxed;
    upBtn.innerHTML = '';
    upBtn.append(level === 0 ? '건설하기' : '업그레이드', h('span', { class: 'btn-sub' }, maxed ? 'MAX' : `💰 ${fmt(cost)}`));

    statusCard.innerHTML = '';
    statusCard.append(h('h3', null, '현황'));
    const nextTier = FAC_TIER_LEVELS.find((v) => v > level);
    if (nextTier !== undefined) {
      statusCard.append(row('다음 외형', `${def.tiers[Math.min(def.tiers.length - 1, tier + 1)]} (Lv.${nextTier})`, 'gold'));
    }
    if (id === 'power') {
      statusCard.append(row('전력 공급', fmt(cs.powerSupply)));
      statusCard.append(row('전력 수요', fmt(cs.powerDemand), cs.powerEff < 1 ? 'bad' : ''));
      statusCard.append(row('산출 배율', `${Math.round(cs.powerEff * 100)}%`, cs.powerEff < 1 ? 'bad' : 'good'));
    } else if (id === 'housing') {
      statusCard.append(row('인구', formatInt(st.city.pop)));
      statusCard.append(row('인구 상한', formatInt(cs.popCap)));
      statusCard.append(row('노동력 공급', fmt(cs.laborSupply)));
      statusCard.append(row('필요 인구', fmt(cs.popDemand), cs.laborSupply < cs.popDemand ? 'bad' : 'good'));
    } else if (id === 'hospital') {
      statusCard.append(row('노동력 공급', fmt(cs.laborSupply), 'good'));
    } else if (id === 'school') {
      statusCard.append(row('전 사업 산출', `x${cs.outputMult.toFixed(2)}`, 'good'));
    } else if (id === 'shops') {
      statusCard.append(row('세수 배율', `x${cs.taxMult.toFixed(2)}`, 'good'));
    } else if (id === 'green') {
      statusCard.append(row('인구 유입', `x${cs.popGrowthMult.toFixed(2)}`, 'good'));
      statusCard.append(row('현재 인구', formatInt(st.city.pop)));
    } else if (id === 'road') {
      statusCard.append(row('자원 이동 지연', `${cs.transferDelay.toFixed(0)}초`, 'good'));
      statusCard.append(row('사슬 요구량', `x${cs.chainDemandMult.toFixed(2)}`, 'good'));
      statusCard.append(row('오프라인 상한', formatDuration(offlineCapSeconds(st))));
      statusCard.append(row('오프라인 효율', `${Math.round(offlineRate(st) * 100)}%`));
    } else if (id === 'fire') {
      statusCard.append(row('사고 확률', `x${cs.accidentMult.toFixed(2)}`, 'good'));
    } else if (id === 'police') {
      statusCard.append(row('손실 방지', `${Math.round(cs.lossPrevent * 100)}%`, 'good'));
    }
    statusCard.append(h('div', { class: 'small muted', style: { marginTop: '8px' } }, def.seeing));
  }

  update();
  return { root, update, draw };
}
