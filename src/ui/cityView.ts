import { BUSINESSES, RESOURCE_META } from '../data/businesses';
import { CONFIG } from '../data/config';
import {
  businessRatePerSecond,
  chainActive,
  isBoosted,
  isUnlocked,
  offlineCapSeconds,
  offlineRate,
  projectedEfficiency,
  totalCashPerSecond,
} from '../core/economy';
import { formatDuration, formatInt, formatNumber } from '../core/num';
import { cityProgress, cumulativeTaxForLevel, logisticsCost, storageCost } from '../core/progression';
import { missionComplete } from '../core/missions';
import type { Game } from '../core/game';
import type { BusinessId } from '../core/types';
import { clear, h } from './dom';
import { fitCanvas } from './scene/gfx';
import { drawCity } from './scene/city';
import type { View } from './businessView';
import {
  showAttendanceSheet,
  showMissionSheet,
  showPrestigeSheet,
  showSettingsSheet,
  showShopSheet,
} from './modals';

export function createCityView(game: Game, onSelect: (id: BusinessId) => void): View {
  const fmt = (v: number) => formatNumber(v, game.state.settings.notation);

  const heroCanvas = h('canvas', { class: 'city-art' });
  const heroLv = h('div', { class: 'hero-lv' }, '');
  const heroBar = h('i', { style: { width: '0%' } });
  const heroNext = h('div', { class: 'hero-next' }, '');
  const heroBadge = h('div', { class: 'hero-badge' }, '');
  const hero = h('div', { class: 'city-hero' }, heroCanvas, heroBadge);
  const levelCard = h(
    'div',
    { class: 'card level-card' },
    heroLv,
    h('div', { class: 'bar' }, heroBar),
    heroNext,
  );

  const bizList = h('div', { class: 'biz-list' });
  const resList = h('div', { class: 'card' });

  const storageBtn = h('button', { class: 'grow' }, '');
  const logisticsBtn = h('button', { class: 'grow' }, '');
  const offlineInfo = h('div', { class: 'small muted' }, '');
  const facilityCard = h(
    'div',
    { class: 'card' },
    h('h3', null, '도시 시설 — 오프라인 수익'),
    offlineInfo,
    h('div', { class: 'row', style: { marginTop: '8px', gap: '6px' } }, storageBtn, logisticsBtn),
  );

  const missionBtn = h('button', { class: 'grow' }, '');
  const attendBtn = h('button', { class: 'grow' }, '');
  const shopBtn = h('button', { class: 'grow' }, '🛒 상점');
  const prestigeBtn = h('button', { class: 'grow' }, '');
  const settingsBtn = h('button', { class: 'grow' }, '⚙️ 설정');

  missionBtn.addEventListener('click', () => showMissionSheet(game));
  attendBtn.addEventListener('click', () => showAttendanceSheet(game));
  shopBtn.addEventListener('click', () => showShopSheet(game));
  prestigeBtn.addEventListener('click', () => showPrestigeSheet(game));
  settingsBtn.addEventListener('click', () => showSettingsSheet(game));
  storageBtn.addEventListener('click', () => game.buyStorage());
  logisticsBtn.addEventListener('click', () => game.buyLogistics());

  const menuCard = h(
    'div',
    { class: 'card' },
    h('div', { class: 'row', style: { gap: '6px', marginBottom: '6px' } }, missionBtn, attendBtn),
    h('div', { class: 'row', style: { gap: '6px', marginBottom: '6px' } }, shopBtn, prestigeBtn),
    h('div', { class: 'row', style: { gap: '6px' } }, settingsBtn),
  );

  const root = h(
    'div',
    null,
    hero,
    levelCard,
    h('h3', { class: 'muted section' }, '사업 현황'),
    bizList,
    resList,
    facilityCard,
    menuCard,
  );

  let renderedLevel = -1;
  let renderedUnlocks = -1;

  function rebuildBizList(): void {
    clear(bizList);
    for (const def of BUSINESSES) {
      const unlocked = isUnlocked(game.state, def);
      const row = h(
        'div',
        {
          class: `biz-row${unlocked ? '' : ' locked'}`,
          style: { '--accent': def.color } as unknown as string,
          onclick: () => unlocked && onSelect(def.id),
        },
        h('div', { class: 'biz-icon' }, unlocked ? def.icon : '🔒'),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'biz-name' }, def.name),
          h('div', { class: 'biz-meta', 'data-role': 'meta' }, ''),
        ),
        h('div', { class: 'biz-rate', 'data-role': 'rate' }, ''),
      );
      bizList.appendChild(row);
    }
  }

  function updateBizList(): void {
    const st = game.state;
    const now = Date.now();
    BUSINESSES.forEach((def, idx) => {
      const row = bizList.children[idx] as HTMLElement;
      if (!row) return;
      const meta = row.querySelector('[data-role=meta]') as HTMLElement;
      const rateEl = row.querySelector('[data-role=rate]') as HTMLElement;
      if (!isUnlocked(st, def)) {
        meta.textContent = `도시 레벨 ${def.unlockCityLevel}에 열립니다`;
        rateEl.textContent = '';
        return;
      }
      const eff = projectedEfficiency(st, def, now);
      const rate = businessRatePerSecond(st, def, now).cash * eff;
      const bits: string[] = [];
      if (def.input && chainActive(st)) bits.push(`가동률 ${Math.round(eff * 100)}%`);
      if (isBoosted(st, def.id, now)) bits.push('⚡부스터');
      const units = st.businesses[def.id].units;
      bits.push(`자동화 ${units.filter((u) => u.level > 0 && u.manager).length}/${units.filter((u) => u.level > 0).length}`);
      meta.textContent = bits.join(' · ');
      rateEl.textContent = `${fmt(rate)}/초`;
    });
  }

  function updateResources(): void {
    const st = game.state;
    clear(resList);
    resList.appendChild(h('h3', null, '도시 자원'));
    const rows: [string, number, string][] = [];
    for (const key of ['ore', 'goods', 'food', 'pop'] as const) {
      const producer = BUSINESSES.find((b) => b.output === key);
      if (!producer || !isUnlocked(st, producer)) continue;
      const meta = RESOURCE_META[key];
      rows.push([`${meta.icon} ${meta.name}`, st.resources[key], key === 'pop' ? '노동력 배율' : '']);
    }
    if (rows.length === 0) {
      resList.appendChild(h('div', { class: 'small muted' }, '아직 생산되는 자원이 없습니다'));
      return;
    }
    for (const [label, value, note] of rows) {
      resList.appendChild(
        h(
          'div',
          { class: 'row spread', style: { padding: '3px 0' } },
          h('span', null, label, note ? h('span', { class: 'small muted' }, ` · ${note}`) : null),
          h('b', null, formatInt(value, st.settings.notation)),
        ),
      );
    }
  }

  function draw(t: number): void {
    const w = hero.clientWidth;
    const hh = hero.clientHeight;
    if (w <= 0 || hh <= 0) return;
    const st = game.state;
    drawCity(fitCanvas(heroCanvas, w, hh), w, hh, st.city.level, BUSINESSES.filter((b) => isUnlocked(st, b)), t);
  }

  function update(): void {
    const st = game.state;
    const unlockedCount = BUSINESSES.filter((b) => isUnlocked(st, b)).length;
    if (st.city.level !== renderedLevel || unlockedCount !== renderedUnlocks) {
      renderedLevel = st.city.level;
      renderedUnlocks = unlockedCount;
      rebuildBizList();
      updateResources();
    }

    const prog = cityProgress(st);
    heroBadge.textContent = `도시 Lv.${st.city.level}`;
    heroLv.innerHTML = '';
    heroLv.append(h('b', null, `도시 Lv.${st.city.level}`), h('span', { class: 'hero-tax' }, `세수 ${fmt(prog.current)} / ${fmt(prog.need)}`));
    heroBar.style.width = `${prog.ratio * 100}%`;
    const nextBiz = BUSINESSES.find((b) => b.unlockCityLevel > st.city.level);
    const remain = Math.max(0, cumulativeTaxForLevel(st.city.level + 1) - st.city.taxRun);
    const perSec = totalCashPerSecond(st) * CONFIG.taxRate;
    heroNext.textContent =
      (perSec > 0 ? `다음 레벨까지 약 ${formatDuration(remain / perSec)}` : '수익을 올려 도시를 키우세요') +
      (nextBiz ? ` · Lv.${nextBiz.unlockCityLevel}에 ${nextBiz.icon} ${nextBiz.name} 해금` : '');

    updateBizList();

    const scost = storageCost(st);
    const maxStorage = st.city.storageLevel >= CONFIG.offline.maxStorageLevel;
    storageBtn.className = `grow ${!maxStorage && st.resources.cash >= scost ? 'primary' : ''}`;
    storageBtn.disabled = maxStorage;
    storageBtn.innerHTML = '';
    storageBtn.append(`📦 창고 Lv.${st.city.storageLevel}`, h('span', { class: 'btn-sub' }, maxStorage ? 'MAX' : fmt(scost)));

    const lcost = logisticsCost(st);
    const maxLog = st.city.logisticsLevel >= CONFIG.offline.maxLogisticsLevel;
    logisticsBtn.className = `grow ${!maxLog && st.resources.cash >= lcost ? 'primary' : ''}`;
    logisticsBtn.disabled = maxLog;
    logisticsBtn.innerHTML = '';
    logisticsBtn.append(`🚚 물류 Lv.${st.city.logisticsLevel}`, h('span', { class: 'btn-sub' }, maxLog ? 'MAX' : fmt(lcost)));
    offlineInfo.textContent = `최대 ${formatDuration(offlineCapSeconds(st))} 동안 효율 ${Math.round(offlineRate(st) * 100)}% 로 수익이 쌓입니다`;

    const doneCount = st.missions.ids.filter((_, i) => missionComplete(st, i) && !st.missions.claimed[i]).length;
    missionBtn.innerHTML = '';
    missionBtn.className = `grow ${doneCount > 0 ? 'gold' : ''}`;
    missionBtn.append('📋 일일 미션', h('span', { class: 'btn-sub' }, doneCount > 0 ? `${doneCount}개 수령 가능` : `${st.missions.claimed.filter(Boolean).length}/${st.missions.ids.length} 완료`));

    attendBtn.innerHTML = '';
    attendBtn.className = `grow ${!st.attendance.claimedToday ? 'gold' : ''}`;
    attendBtn.append('📅 출석', h('span', { class: 'btn-sub' }, st.attendance.claimedToday ? '내일 다시' : `${st.attendance.streak + 1}일차 수령`));

    const canP = game.canPrestige();
    prestigeBtn.className = `grow ${canP ? 'gold' : ''}`;
    prestigeBtn.innerHTML = '';
    prestigeBtn.append('🏗️ 재개발', h('span', { class: 'btn-sub' }, canP ? `📐 ${formatInt(game.prestigeGain())}` : `Lv.${CONFIG.prestige.unlockCityLevel} 필요`));
  }

  update();
  return { root, update, draw };
}
