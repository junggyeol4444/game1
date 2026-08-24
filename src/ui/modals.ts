import { CONFIG } from '../data/config';
import { BUSINESSES } from '../data/businesses';
import { BUSINESS_TIERS, FACILITIES } from '../data/buildings';
import { buildableFacilities, builtFacilities, cityStats, facilityCost } from '../core/facilities';
import { RARE_FISH } from './minigames/games';

import { IAP_PRODUCTS } from '../core/iap';
import { formatDuration, formatInt, formatNumber } from '../core/num';
import { totalCashPerSecond, offlineCapSeconds, offlineRate, offlineUpgradeCost, isUnlocked } from '../core/economy';
import { legacyUpgradeCost, cityProgress, cityRequirement, legacyUpgradeList } from '../core/progression';
import {
  LEGACY,
  bizIcon,
  bizName,
  facIcon,
  facName,
  leaderTitle,
  settlementName,
} from '../core/era';
import { ERAS, settlementNameOf } from '../data/eras';
import { terrainStage } from '../data/buildings';
import { missionComplete, missionDef, missionTarget } from '../core/missions';
import type { Game } from '../core/game';
import type { BusinessDef, BusinessId, GameState, OfflineReport } from '../core/types';
import type { MinigameResult } from './minigames/host';
import { append, clear, h } from './dom';
import { exportSave, importSave, wipe } from '../core/save';
import { setSoundEnabled } from '../core/audio';

const fmt = (state: GameState, v: number) => formatNumber(v, state.settings.notation);

export interface SheetHandle {
  close: () => void;
  body: HTMLElement;
}

export function sheet(opts: {
  title: string;
  sub?: string;
  dismissible?: boolean;
  build: (handle: SheetHandle) => (Node | string | false | null)[];
}): SheetHandle {
  const body = h('div', { class: 'sheet-body' });
  const scrim = h('div', { class: 'scrim' });
  const panel = h(
    'div',
    { class: 'sheet', onclick: (e: Event) => e.stopPropagation() },
    h('h2', null, opts.title),
    opts.sub ? h('div', { class: 'sub' }, opts.sub) : null,
    body,
  );
  scrim.appendChild(panel);
  const handle: SheetHandle = {
    body,
    close: () => scrim.remove(),
  };
  append(body, opts.build(handle));
  if (opts.dismissible !== false) {
    scrim.addEventListener('click', () => handle.close());
  }
  document.body.appendChild(scrim);
  return handle;
}

/** 복귀 보상 (Daily Double) — 앱 시작 시 가장 먼저 뜬다 */
export function showOfflineModal(game: Game, report: OfflineReport): void {
  const s = game.state;
  const capped = report.cappedSeconds < report.seconds;
  sheet({
    title: `다녀오셨습니까, ${leaderTitle(s)}님`,
    sub: `${formatDuration(report.seconds)} 동안 도시가 돌아갔습니다`,
    dismissible: false,
    build: (hd) => {
      const lines = report.perBusiness
        .filter((p) => p.cash > 0)
        .map((p) => {
          return h(
            'div',
            { class: 'row spread small', style: { padding: '4px 0' } },
            h('span', null, `${bizIcon(s, p.id)} ${bizName(s, p.id)}`),
            h('b', { class: 'gold' }, fmt(s, p.cash)),
          );
        });
      return [
        h(
          'div',
          { class: 'card center' },
          h('div', { class: 'muted small' }, '오프라인 수익'),
          h('div', { class: 'cash', style: { fontSize: 'calc(30px * var(--scale))' } }, fmt(s, report.cash)),
          capped
            ? h(
                'div',
                { class: 'small warn' },
                `상한 ${formatDuration(offlineCapSeconds(s))} 적용됨 · 창고를 늘리면 더 받습니다`,
              )
            : h('div', { class: 'small muted' }, `효율 ${Math.round(offlineRate(s) * 100)}%`),
        ),
        lines.length ? h('div', { class: 'card' }, ...lines) : null,
        h(
          'button',
          {
            class: 'gold wide',
            style: { marginBottom: '8px' },
            onclick: async () => {
              const btn = document.activeElement as HTMLButtonElement | null;
              if (btn) btn.disabled = true;
              await game.claimOffline(true);
              hd.close();
            },
          },
          s.shop.adFree ? '2배로 받기 (광고 제거 적용)' : '광고 보고 2배로 받기',
          h('span', { class: 'btn-sub' }, `+${fmt(s, report.cash)} 추가`),
        ),
        h(
          'button',
          {
            class: 'ghost wide',
            onclick: async () => {
              await game.claimOffline(false);
              hd.close();
            },
          },
          '그냥 받기',
        ),
      ];
    },
  });
}

export function showUnlockModal(game: Game, def: BusinessDef): void {
  const s = game.state;
  sheet({
    title: `${bizName(s, def.id)} 해금!`,
    sub: def.subtitle,
    build: (hd) => [
      h('div', { class: 'card center' }, h('span', { class: 'big-emoji' }, bizIcon(s, def.id)),
        h('div', { class: 'muted small' }, `도시 레벨 ${def.unlockCityLevel} 달성`),
        def.input
          ? h('div', { class: 'small warn', style: { marginTop: '6px' } },
              `이 사업은 상위 자원이 필요합니다 (도시 레벨 ${CONFIG.chainStartLevel}부터 적용)`)
          : null,
      ),
      h('button', { class: 'primary wide', onclick: () => hd.close() }, '확인'),
    ],
  });
}

export function showMissionSheet(game: Game): void {
  const s = game.state;
  sheet({
    title: '일일 미션',
    sub: '매일 자정에 새로 갱신됩니다',
    build: (hd) => {
      const rows = s.missions.ids.map((id, i) => {
        const def = missionDef(id);
        if (!def) return null;
        const target = missionTarget(s, i);
        const prog = Math.min(s.missions.progress[i], target);
        const done = missionComplete(s, i);
        const claimed = s.missions.claimed[i];
        return h(
          'div',
          { class: 'card' },
          h(
            'div',
            { class: 'row' },
            h('span', { style: { fontSize: '22px' } }, def.icon),
            h(
              'div',
              { class: 'grow' },
              h('div', null, def.label(target, s)),
              h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { style: { width: `${(prog / target) * 100}%` } })),
              h('div', { class: 'small muted', style: { marginTop: '3px' } }, `${formatInt(prog)} / ${formatInt(target)}`),
            ),
            h(
              'button',
              {
                class: done && !claimed ? 'gold' : '',
                disabled: !done || claimed,
                onclick: () => {
                  game.claimMission(i);
                  hd.close();
                  showMissionSheet(game);
                },
              },
              claimed ? '완료' : '받기',
            ),
          ),
        );
      });
      return [...rows];
    },
  });
}

export function showAttendanceSheet(game: Game): void {
  game.refreshAttendance();
  const s = game.state;
  sheet({
    title: '7일 출석 보상',
    sub: `오늘 ${s.attendance.claimedToday ? '수령 완료' : '수령 가능'}`,
    build: (hd) => {
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' } });
      CONFIG.attendance.rewards.forEach((r, i) => {
        const isNext = i === s.attendance.streak && !s.attendance.claimedToday;
        const passed = i < s.attendance.streak;
        grid.appendChild(
          h(
            'div',
            {
              class: 'card center',
              style: {
                margin: '0',
                padding: '10px 4px',
                borderColor: isNext ? 'var(--gold)' : 'var(--line)',
                opacity: passed ? '0.5' : '1',
              },
            },
            h('div', { class: 'small muted' }, `${i + 1}일차`),
            h('div', { style: { fontSize: '22px' } }, r.type === 'blueprint' ? LEGACY.icon : r.type === 'boost' ? '⚡' : '💰'),
            h('div', { class: 'small' },
              r.type === 'cashSeconds' ? `${Math.round(r.amount / 60)}분치` :
              r.type === 'boost' ? `${Math.round(r.amount / 60)}분 2배` : `${LEGACY.name} ${r.amount}`),
          ),
        );
      });
      return [
        grid,
        h(
          'button',
          {
            class: 'gold wide',
            style: { marginTop: '12px' },
            disabled: s.attendance.claimedToday,
            onclick: () => {
              game.claimAttendance();
              hd.close();
            },
          },
          s.attendance.claimedToday ? '내일 다시 오세요' : '오늘 보상 받기',
        ),
      ];
    },
  });
}

/** 문명 전환 안내 — 도시를 허물고 넘어온 직후 */
export function showEraArrivalSheet(game: Game, gained: number): void {
  const s = game.state;
  const era = game.era();
  sheet({
    title: `${era.name}`,
    sub: era.tagline,
    dismissible: false,
    build: (hd) => [
      h(
        'div',
        { class: 'card center' },
        h('span', { class: 'big-emoji' }, era.business.mine.icon),
        h('div', { style: { fontWeight: '800', marginTop: '4px' } }, `${settlementNameOf(s.era, 0)}에서 다시 시작합니다`),
        h('div', { class: 'small warn', style: { marginTop: '4px' } },
          `건설·업그레이드 비용 x${formatInt(era.costMult)} · 사이클 x${era.cycleMult.toFixed(2)}`),
        h('div', { class: 'small gold', style: { marginTop: '2px' } }, `${LEGACY.icon} ${LEGACY.name} +${formatInt(gained)}`),
      ),
      h(
        'div',
        { class: 'card small muted' },
        h('div', null, `${era.leader}이 되어 ${era.facility.housing.name}부터 다시 짓습니다.`),
        h('div', null, `유산 강화는 그대로 남습니다.`),
      ),
      h('button', { class: 'primary wide', onclick: () => hd.close() }, '시작하기'),
    ],
  });
}

// ═══════════════ 문명 전환 ═══════════════
export function showEraSheet(game: Game): void {
  const s = game.state;
  const gain = game.legacyGain();
  const can = game.canAdvanceEra();
  const era = game.era();
  const next = game.nextEra();
  const prog = game.eraProgress();
  const final = game.isFinalEra();

  sheet({
    title: '문명 전환',
    sub: '도시를 전부 허물고 다음 문명에서 다시 시작합니다',
    build: (hd) => {
      const shop = h('div');
      const renderShop = () => {
        clear(shop);
        for (const up of legacyUpgradeList(s)) {
          const lv = s.prestige.upgrades[up.id] ?? 0;
          const cost = legacyUpgradeCost(s, up.id);
          const maxed = lv >= up.maxLevel;
          shop.appendChild(
            h(
              'div',
              { class: 'card' },
              h(
                'div',
                { class: 'row' },
                h('span', { style: { fontSize: '22px' } }, up.icon),
                h(
                  'div',
                  { class: 'grow' },
                  h('div', null, `${up.name} `, h('span', { class: 'small muted' }, `Lv.${lv}/${up.maxLevel}`)),
                  h('div', { class: 'small muted' }, up.desc(lv)),
                  maxed ? null : h('div', { class: 'small good' }, `→ ${up.desc(lv + 1)}`),
                ),
                h(
                  'button',
                  {
                    disabled: maxed || s.resources.blueprint < cost,
                    class: !maxed && s.resources.blueprint >= cost ? 'primary' : '',
                    onclick: () => {
                      if (game.buyLegacy(up.id)) renderShop();
                    },
                  },
                  maxed ? 'MAX' : `${LEGACY.icon} ${formatInt(cost)}`,
                ),
              ),
            ),
          );
        }
      };
      renderShop();

      const go = async (withAd: boolean) => {
        const before = game.legacyGain();
        const arrived = await game.doAdvanceEra(withAd);
        if (!arrived) return;
        hd.close();
        showEraArrivalSheet(game, withAd ? Math.floor(before * (1 + CONFIG.era.adBonus)) : before);
      };

      return [
        h(
          'div',
          { class: 'card center' },
          h(
            'div',
            { class: 'row', style: { justifyContent: 'center', gap: '10px' } },
            h('b', null, era.name),
            h('span', { class: 'muted' }, '→'),
            h('b', { class: 'gold' }, final ? '재건' : next.name),
          ),
          h('div', { class: 'small muted', style: { marginTop: '4px' } }, final ? '마지막 시대입니다. 같은 시대를 더 크게 다시 세웁니다' : next.tagline),
          h('div', { class: 'bar', style: { marginTop: '10px' } }, h('i', { style: { width: `${prog.ratio * 100}%` } })),
          h('div', { class: 'small muted', style: { marginTop: '6px' } }, `누적 세수 ${fmt(s, prog.current)} / ${fmt(s, prog.need)}`),
        ),
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'row spread' }, h('span', null, '전환 시 획득'), h('b', { class: 'gold' }, `${LEGACY.icon} ${formatInt(gain)}`)),
          h('div', { class: 'row spread small muted', style: { marginTop: '4px' } },
            h('span', null, '보유'),
            h('span', null, `${LEGACY.icon} ${formatInt(s.resources.blueprint)}`)),
          h('div', { class: 'row spread small muted', style: { marginTop: '4px' } },
            h('span', null, final ? '다음 회차 비용' : '다음 시대 비용'),
            h('span', { class: 'bad' }, `x${formatInt(final ? era.costMult : next.costMult)}`)),
          h('div', { class: 'row spread small muted', style: { marginTop: '4px' } },
            h('span', null, '사이클'),
            h('span', { class: 'bad' }, `x${(final ? era.cycleMult : next.cycleMult).toFixed(2)}`)),
          h('div', { class: 'small warn', style: { marginTop: '8px' } },
            '허물어지는 것 — 자금 · 물자 · 도시 레벨 · 사업 · 시설'),
          h('div', { class: 'small good' }, `남는 것 — ${LEGACY.name} 강화 · 보석 · 도감 · 상점`),
          h(
            'button',
            {
              class: 'gold wide',
              style: { marginTop: '10px' },
              disabled: !can || gain <= 0,
              onclick: () => go(true),
            },
            `광고 보고 전환 (${LEGACY.name} +50%)`,
            h('span', { class: 'btn-sub' }, `${LEGACY.icon} ${formatInt(Math.floor(gain * (1 + CONFIG.era.adBonus)))}`),
          ),
          h(
            'button',
            {
              class: 'ghost wide',
              style: { marginTop: '6px' },
              disabled: !can || gain <= 0,
              onclick: () => go(false),
            },
            '그냥 전환',
          ),
        ),
        h('h3', { class: 'muted', style: { margin: '14px 0 8px' } }, `${LEGACY.name} 강화 (영구)`),
        shop,
        h('h3', { class: 'muted', style: { margin: '14px 0 8px' } }, '문명의 흐름'),
        h(
          'div',
          { class: 'card small' },
          ...ERAS.map((e, i) =>
            h(
              'div',
              { class: 'row spread', style: { padding: '3px 0', opacity: i <= s.era ? '1' : '0.45' } },
              h('span', { class: i === s.era ? 'gold' : '' }, `${i <= s.era ? '●' : '○'} ${e.name}`),
              h('span', { class: 'muted' }, i === s.era ? '지금 여기' : `비용 x${formatInt(e.costMult)} · Lv.${e.advanceLevel}`),
            ),
          ),
        ),
      ];
    },
  });
}

export function showShopSheet(game: Game): void {
  const s = game.state;
  const piggy = game.piggyState();
  sheet({
    title: '상점',
    build: (hd) => {
      const items = IAP_PRODUCTS.filter((p) => {
        if (p.id === 'piggy') return piggy.visible;
        if (p.id === 'adFree') return !s.shop.adFree;
        if (p.oneTime) return !s.shop.purchases.includes(p.id);
        return true;
      }).map((p) => {
        const isPiggy = p.id === 'piggy';
        const locked = isPiggy && !piggy.ready;
        return h(
          'div',
          { class: 'card' },
          h(
            'div',
            { class: 'row' },
            h('span', { style: { fontSize: '26px' } }, p.icon),
            h(
              'div',
              { class: 'grow' },
              h('div', null, p.title, !s.shop.firstPurchaseDone && p.id === 'starter' ? h('span', { class: 'chip on', style: { marginLeft: '6px' } }, '추천') : null),
              h('div', { class: 'small muted' }, p.desc),
              isPiggy
                ? h(
                    'div',
                    null,
                    h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { style: { width: `${piggy.progress * 100}%` } })),
                    h('div', { class: 'small muted', style: { marginTop: '3px' } }, `${Math.round(piggy.progress * 100)}% 채움 · 가득 차면 개봉 가능`),
                  )
                : null,
            ),
            h(
              'button',
              {
                class: locked ? '' : 'gold',
                disabled: locked,
                onclick: async () => {
                  if (await game.purchase(p.id)) {
                    hd.close();
                    showShopSheet(game);
                  }
                },
              },
              locked ? '???' : p.priceLabel,
            ),
          ),
        );
      });
      return [
        ...items,
        h('div', { class: 'small muted center', style: { marginTop: '10px' } },
          '※ 확률형 아이템(가챠)은 판매하지 않습니다.'),
      ];
    },
  });
}

export function showSettingsSheet(game: Game): void {
  const s = game.state;
  sheet({
    title: '설정',
    build: (hd) => {
      const seg = (label: string, options: [string, () => boolean, () => void][]) =>
        h(
          'div',
          { class: 'card' },
          h('h3', null, label),
          h(
            'div',
            { class: 'seg' },
            ...options.map(([text, on, set]) =>
              h('button', {
                class: on() ? 'on' : '',
                onclick: () => {
                  set();
                  game.persist();
                  hd.close();
                  showSettingsSheet(game);
                  game.emit('structure');
                },
              }, text),
            ),
          ),
        );
      return [
        seg('글자 크기', [
          ['보통', () => s.settings.textScale === 1, () => (s.settings.textScale = 1)],
          ['크게', () => s.settings.textScale === 1.15, () => (s.settings.textScale = 1.15)],
          ['아주 크게', () => s.settings.textScale === 1.3, () => (s.settings.textScale = 1.3)],
        ]),
        seg('숫자 표기', [
          ['축약 (1.2K)', () => s.settings.notation === 'short', () => (s.settings.notation = 'short')],
          ['지수 (1.2e3)', () => s.settings.notation === 'scientific', () => (s.settings.notation = 'scientific')],
        ]),
        seg('애니메이션', [
          ['켜기', () => !s.settings.reducedMotion, () => (s.settings.reducedMotion = false)],
          ['줄이기', () => s.settings.reducedMotion, () => (s.settings.reducedMotion = true)],
        ]),
        seg('소리', [
          ['켜기', () => s.settings.sound, () => { s.settings.sound = true; setSoundEnabled(true); }],
          ['끄기', () => !s.settings.sound, () => { s.settings.sound = false; setSoundEnabled(false); }],
        ]),
        seg('진동', [
          ['켜기', () => s.settings.haptics, () => (s.settings.haptics = true)],
          ['끄기', () => !s.settings.haptics, () => (s.settings.haptics = false)],
        ]),
        h(
          'div',
          { class: 'card' },
          h('h3', null, '세이브'),
          h('button', {
            class: 'wide', style: { marginBottom: '6px' },
            onclick: () => {
              navigator.clipboard?.writeText(exportSave(s));
              game.toast('세이브를 클립보드에 복사했습니다');
            },
          }, '세이브 내보내기'),
          h('button', {
            class: 'wide', style: { marginBottom: '6px' },
            onclick: () => {
              const text = prompt('세이브 문자열을 붙여넣으세요');
              if (!text) return;
              const loaded = importSave(text);
              if (!loaded) return game.toast('불러오기 실패');
              game.state = loaded;
              game.persist();
              location.reload();
            },
          }, '세이브 불러오기'),
          h('button', {
            class: 'wide bad',
            onclick: () => {
              if (!confirm('정말 처음부터 다시 시작할까요? 되돌릴 수 없습니다.')) return;
              wipe();
              location.reload();
            },
          }, '처음부터 다시 시작'),
        ),
        h(
          'div',
          { class: 'card small muted' },
          h('div', null, `누적 플레이 ${formatDuration(s.stats.playSeconds)}`),
          h('div', null, `누적 수익 ${fmt(s, s.stats.cashEarnedTotal)}`),
          h('div', null, `문명 전환 ${s.prestige.count}회 · 광고 ${s.stats.adsWatched}회`),
          h('div', null, `다음 도시 레벨까지 세수 ${fmt(s, Math.max(0, cityRequirement(s.city.level + 1) - s.city.taxRun))}`),
        ),
      ];
    },
  });
}

/** 자금 부족 시 뜨는 광고 제안 */
export function showCashDropSheet(game: Game): void {
  const s = game.state;
  const amount = Math.max(100, totalCashPerSecond(s) * CONFIG.ads.cashDropSeconds);
  sheet({
    title: '자금이 부족한가요?',
    build: (hd) => [
      h('div', { class: 'card center' },
        h('div', { class: 'muted small' }, '광고 시청 시 즉시 지급'),
        h('div', { class: 'cash' }, fmt(s, amount)),
        h('div', { class: 'small muted' }, '현재 수입 15분치')),
      h('button', {
        class: 'ad wide',
        disabled: !game.ads.isAvailable('cashDrop'),
        onclick: async () => {
          if (await game.adCashDrop()) hd.close();
        },
      }, game.ads.isAvailable('cashDrop') ? '광고 보고 받기' : `${Math.ceil(game.ads.cooldownRemaining('cashDrop'))}초 후 가능`),
      h('button', { class: 'ghost wide', style: { marginTop: '6px' }, onclick: () => { hd.close(); showShopSheet(game); } }, '상점 보기'),
    ],
  });
}

export function unlockedBusinesses(state: GameState): BusinessDef[] {
  return BUSINESSES.filter((b) => isUnlocked(state, b));
}

// ═══════════════ 미니게임 결과 ═══════════════
const GRADE_TEXT: Record<string, { color: string; line: string }> = {
  S: { color: '#FFC845', line: '완벽했습니다' },
  A: { color: '#8FD3A8', line: '좋습니다' },
  B: { color: '#8FB8E8', line: '나쁘지 않습니다' },
  C: { color: '#C4B191', line: '감이 필요합니다' },
  F: { color: '#E85D4A', line: '다음엔 됩니다' },
};

/** 판 끝나고 뜨는 성적표. 토스트로는 배율·특산물이 안 보인다 */
export function showMinigameResult(game: Game, id: BusinessId, r: MinigameResult): void {
  const s = game.state;
  const g = GRADE_TEXT[r.grade] ?? GRADE_TEXT.C;
  const left = game.minigamePlaysLeft(id);
  const adLeft = game.minigameAdPlaysLeft(id);
  sheet({
    title: `${bizName(s, id)} 미니게임`,
    build: (hd) => [
      h(
        'div',
        { class: 'card center' },
        h('div', { class: 'mg-grade', style: { color: g.color } }, r.grade),
        h('div', { class: 'muted small' }, g.line),
      ),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'row spread', style: { padding: '3px 0' } },
          h('span', { class: 'muted' }, '성공률'), h('b', null, `${Math.round(r.rate * 100)}%`)),
        h('div', { class: 'row spread', style: { padding: '3px 0' } },
          h('span', { class: 'muted' }, '점수'), h('b', null, `${formatInt(r.score)} / ${formatInt(r.target)}`)),
        h('div', { class: 'row spread', style: { padding: '3px 0' } },
          h('span', { class: 'muted' }, '성적 배율'), h('b', { class: 'good' }, `x${r.mult.toFixed(2)}`)),
        h('div', { class: 'row spread', style: { padding: '3px 0' } },
          h('span', { class: 'muted' }, '보상'), h('b', { class: 'gold' }, `💰 ${fmt(s, r.reward ?? 0)}`)),
        r.spoilText ? h('div', { class: 'row spread', style: { padding: '3px 0' } },
          h('span', { class: 'muted' }, '특산물'), h('b', { class: 'gold' }, r.spoilText)) : null,
        r.rate >= 0.8
          ? h('div', { class: 'small good', style: { marginTop: '6px' } },
              `${r.rate >= 0.95 ? 3 : 2}배 가동 ${Math.round(CONFIG.minigame.boostSeconds / 60)}분 적용`)
          : h('div', { class: 'small muted', style: { marginTop: '6px' } }, '성공률 80% 이상이면 30분간 2배로 돕니다'),
      ),
      h(
        'button',
        {
          class: left > 0 || adLeft > 0 ? 'primary wide' : 'wide',
          disabled: left <= 0 && adLeft <= 0,
          onclick: async () => {
            hd.close();
            const again = await game.playMinigame(id);
            if (again) showMinigameResult(game, id, again);
          },
        },
        '한 판 더',
        h('span', { class: 'btn-sub' }, left > 0 ? `무료 ${left}회` : adLeft > 0 ? `광고 +1 (${adLeft})` : '내일 다시'),
      ),
      h('button', { class: 'ghost wide', style: { marginTop: '6px' }, onclick: () => hd.close() }, '닫기'),
    ],
  });
}

// ═══════════════ 건설 ═══════════════
export function showBuildSheet(game: Game, onEnter: (id: string) => void): void {
  const s = game.state;
  sheet({
    title: '건설',
    sub: '도시 레벨이 오르면 지을 수 있는 건물이 늘어납니다',
    build: (hd) => {
      const buildable = buildableFacilities(s);
      const locked = FACILITIES.filter((f) => s.city.level < f.unlockCityLevel);
      const built = builtFacilities(s);

      const card = (f: (typeof FACILITIES)[number], state: 'can' | 'locked' | 'built') => {
        const cost = facilityCost(s, f.id);
        const ok = s.resources.cash >= cost;
        return h(
          'div',
          { class: 'card', style: { borderLeft: `4px solid ${f.color}` } },
          h(
            'div',
            { class: 'row' },
            h('span', { style: { fontSize: '26px' } }, facIcon(s, f.id)),
            h(
              'div',
              { class: 'grow' },
              h('div', { style: { fontWeight: '800' } }, facName(s, f.id)),
              h('div', { class: 'small muted' }, f.effect),
              state === 'can'
                ? h('div', { class: 'small', style: { marginTop: '3px' } }, `💰 ${fmt(s, cost)}`)
                : null,
            ),
            state === 'locked'
              ? h('span', { class: 'chip' }, `Lv.${f.unlockCityLevel}`)
              : state === 'built'
                ? h(
                    'button',
                    {
                      onclick: () => {
                        hd.close();
                        onEnter(f.id);
                      },
                    },
                    '들어가기',
                  )
                : h(
                    'button',
                    {
                      class: ok ? 'gold' : '',
                      disabled: !ok,
                      onclick: () => {
                        if (game.buyFacility(f.id)) {
                          hd.close();
                          onEnter(f.id);
                        }
                      },
                    },
                    '건설',
                  ),
          ),
        );
      };

      return [
        buildable.length ? h('h3', { class: 'muted' }, '지을 수 있는 건물') : null,
        ...buildable.map((f) => card(f, 'can')),
        built.length ? h('h3', { class: 'muted', style: { marginTop: '12px' } }, '건설 완료') : null,
        ...built.map((f) => card(f, 'built')),
        locked.length ? h('h3', { class: 'muted', style: { marginTop: '12px' } }, '잠김') : null,
        ...locked.map((f) => card(f, 'locked')),
      ];
    },
  });
}

// ═══════════════ 도시 레벨 ═══════════════
export function showCityLevelSheet(game: Game): void {
  const s = game.state;
  const cs = cityStats(s);
  const prog = cityProgress(s);
  sheet({
    title: `${settlementName(s)} · Lv.${s.city.level}`,
    sub: `${game.era().name} — 세수가 쌓이면 도시 레벨이 오르고 새 건물이 열립니다`,
    build: () => {
      const row = (label: string, value: string, tone = '') =>
        h('div', { class: 'row spread', style: { padding: '4px 0' } }, h('span', { class: 'muted' }, label), h('b', { class: tone }, value));

      const nextBiz = BUSINESSES.filter((b) => b.unlockCityLevel > s.city.level).slice(0, 2);
      const nextFac = FACILITIES.filter((f) => f.unlockCityLevel > s.city.level).slice(0, 3);

      return [
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'bar' }, h('i', { style: { width: `${prog.ratio * 100}%` } })),
          h('div', { class: 'small muted', style: { marginTop: '6px' } }, `세수 ${fmt(s, prog.current)} / ${fmt(s, prog.need)}`),
        ),
        h(
          'div',
          { class: 'card' },
          h('h3', null, '도시 현황'),
          row('인구', formatInt(s.city.pop), ''),
          row('인구 상한', formatInt(cs.popCap)),
          row('노동력', `${fmt(s, cs.laborSupply)} / ${fmt(s, cs.popDemand)}`, cs.laborSupply < cs.popDemand ? 'bad' : 'good'),
          row('전력', `${fmt(s, cs.powerSupply)} / ${fmt(s, cs.powerDemand)}`, cs.powerEff < 1 ? 'bad' : 'good'),
          row('산출 배율', `${Math.round(cs.powerEff * 100)}%`, cs.powerEff < 1 ? 'warn' : 'good'),
          row('세수 배율', `x${cs.taxMult.toFixed(2)}`, 'good'),
          row('전 사업 산출', `x${cs.outputMult.toFixed(2)}`, 'good'),
        ),
        nextBiz.length || nextFac.length
          ? h(
              'div',
              { class: 'card' },
              h('h3', null, '다음 해금'),
              ...nextBiz.map((b) => row(`${bizIcon(s, b.id)} ${bizName(s, b.id)}`, `Lv.${b.unlockCityLevel}`)),
              ...nextFac.map((f) => row(`${facIcon(s, f.id)} ${facName(s, f.id)}`, `Lv.${f.unlockCityLevel}`)),
            )
          : null,
        h(
          'div',
          { class: 'card' },
          h('h3', null, `${game.era().name} 발전 단계`),
          ...game.era().settlement.map((name, i) =>
            row(name, terrainStage(s.city.level) === i ? '지금 여기' : '', terrainStage(s.city.level) === i ? 'gold' : 'muted'),
          ),
        ),
      ];
    },
  });
}

// ═══════════════ 도감 ═══════════════
export function showCollectionSheet(game: Game): void {
  const s = game.state;
  sheet({
    title: '도감',
    sub: '건물 외형과 미니게임 특산물을 모읍니다',
    build: () => {
      const all = [
        ...BUSINESSES.map((b) => ({ id: b.id as string, icon: bizIcon(s, b.id), name: bizName(s, b.id), tiers: BUSINESS_TIERS[b.id] })),
        ...FACILITIES.map((f) => ({ id: f.id as string, icon: facIcon(s, f.id), name: facName(s, f.id), tiers: f.tiers })),
      ];
      const seen = s.collection.seenTiers;
      const total = all.reduce((a, b) => a + b.tiers.length - 1, 0);
      const got = all.reduce((a, b) => a + Math.min(seen[b.id] ?? 0, b.tiers.length - 1), 0);

      const spoils = [
        { icon: '💎', name: '보석', v: s.resources.gem, from: '광산 미니게임 · 엘리베이터 재료' },
        { icon: '🔩', name: '고급 규격품', v: s.collection.specs, from: '공장 미니게임' },
        { icon: '💗', name: '만족도', v: s.collection.satisfaction, from: '놀이공원 미니게임' },
        { icon: '💼', name: '투자 자금', v: s.collection.funds, from: '기업 미니게임' },
      ];

      return [
        h(
          'div',
          { class: 'card center' },
          h('div', { class: 'muted small' }, '건물 외형'),
          h('div', { class: 'cash' }, `${got} / ${total}`),
        ),
        ...all.map((b) =>
          h(
            'div',
            { class: 'card' },
            h(
              'div',
              { class: 'row' },
              h('span', { style: { fontSize: '22px' } }, b.icon),
              h(
                'div',
                { class: 'grow' },
                h('div', { style: { fontWeight: '700' } }, b.name),
                h(
                  'div',
                  { class: 'small muted' },
                  b.tiers
                    .slice(1)
                    .map((name, i) => ((seen[b.id] ?? 0) >= i + 1 ? name : '???'))
                    .join(' → '),
                ),
              ),
              h('span', { class: 'chip' }, `${Math.min(seen[b.id] ?? 0, b.tiers.length - 1)}/${b.tiers.length - 1}`),
            ),
          ),
        ),
        h('h3', { class: 'muted', style: { marginTop: '12px' } }, '특산물 — 자동화로는 못 얻습니다'),
        ...spoils.map((sp) =>
          h(
            'div',
            { class: 'card' },
            h(
              'div',
              { class: 'row' },
              h('span', { style: { fontSize: '22px' } }, sp.icon),
              h('div', { class: 'grow' }, h('div', null, sp.name), h('div', { class: 'small muted' }, sp.from)),
              h('b', { class: 'gold' }, formatInt(sp.v)),
            ),
          ),
        ),
        h(
          'div',
          { class: 'card' },
          h(
            'div',
            { class: 'row' },
            h('span', { style: { fontSize: '22px' } }, '🐠'),
            h(
              'div',
              { class: 'grow' },
              h('div', null, '희귀 어종'),
              h('div', { class: 'small muted' }, RARE_FISH.map((f) => (s.collection.fish.includes(f) ? f : '???')).join(' · ')),
            ),
            h('b', { class: 'gold' }, `${s.collection.fish.length}/${RARE_FISH.length}`),
          ),
        ),
      ];
    },
  });
}

// ═══════════════ 메뉴 ═══════════════
export function showMenuSheet(game: Game): void {
  const s = game.state;
  sheet({
    title: '메뉴',
    build: (hd) => {
      const item = (icon: string, name: string, sub: string, run: () => void, hot = false) =>
        h(
          'button',
          {
            class: `wide ${hot ? 'gold' : ''}`,
            style: { marginBottom: '8px', textAlign: 'left' },
            onclick: () => {
              hd.close();
              run();
            },
          },
          `${icon} ${name}`,
          h('span', { class: 'btn-sub' }, sub),
        );
      return [
        item('📅', '출석 보상', s.attendance.claimedToday ? '내일 다시' : `${s.attendance.streak + 1}일차 수령 가능`, () => showAttendanceSheet(game), !s.attendance.claimedToday),
        item(
          '🏛️',
          '문명 전환',
          game.canAdvanceEra()
            ? `${game.nextEra().name}로 — ${LEGACY.name} ${formatInt(game.legacyGain())} 획득`
            : `${game.era().name} · 누적 세수 ${fmt(s, game.eraThreshold())} 필요`,
          () => showEraSheet(game),
          game.canAdvanceEra(),
        ),
        item('🛒', '상점', '스타터 팩 · 저금통 · 광고 제거', () => showShopSheet(game)),
        item('📦', '창고 / 물류', `오프라인 최대 ${formatDuration(offlineCapSeconds(s))}`, () => showFacilityUpgradeSheet(game)),
        item('⚙️', '설정', '글자 크기 · 숫자 표기 · 세이브', () => showSettingsSheet(game)),
      ];
    },
  });
}

/** 오프라인 수익 업그레이드 (물자 소비, 기획서 수치표 7장) */
export function showFacilityUpgradeSheet(game: Game): void {
  const s = game.state;
  sheet({
    title: '오프라인 수익',
    sub: '자리를 비운 동안 쌓이는 수익을 늘립니다 (물자 소비)',
    build: (hd) => {
      const mk = (label: string, level: number, note: string, run: () => boolean) => {
        const cost = offlineUpgradeCost(level);
        const maxed = level >= 5;
        return h(
          'div',
          { class: 'card' },
          h(
            'div',
            { class: 'row' },
            h('div', { class: 'grow' }, h('div', null, `${label} ${level}/5단계`), h('div', { class: 'small muted' }, note)),
            h(
              'button',
              {
                class: !maxed && s.resources.material >= cost ? 'buy' : 'dim',
                disabled: maxed,
                onclick: () => {
                  if (run()) {
                    hd.close();
                    showFacilityUpgradeSheet(game);
                  }
                },
              },
              maxed ? 'MAX' : `📦 ${fmt(s, cost)}`,
            ),
          ),
        );
      };
      return [
        mk('📦 저장 상한', s.city.capLevel, `최대 ${formatDuration(offlineCapSeconds(s))}`, () => game.buyOfflineCap()),
        mk('🚚 회수 효율', s.city.effLevel, `효율 ${Math.round(offlineRate(s) * 100)}%`, () => game.buyOfflineEff()),
      ];
    },
  });
}
