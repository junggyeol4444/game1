/**
 * 첫 60초 튜토리얼 (광산 문서 7장).
 *
 * 원칙:
 *  - 읽는 튜토리얼이 아니라 **누르는 튜토리얼**이다. 매 단계가 실제 조작 1개다.
 *  - 화면을 막지 않는다. 눌러야 할 곳만 뚫어 놓고 나머지를 살짝 어둡게 한다.
 *  - 조건이 충족되면 자동으로 다음 단계로 넘어간다. '다음' 버튼이 없다.
 *  - 언제든 건너뛸 수 있다. 다시 안 뜬다.
 */
import { FACILITY_BY_ID } from '../data/buildings';
import { bizName, facName } from '../core/era';
import { TUTORIAL_DONE } from '../core/state';
import type { Game } from '../core/game';
import type { BuildingId } from '../data/buildings';
import type { GameState } from '../core/types';
import { h } from './dom';

export { TUTORIAL_DONE };

export interface TutorialCtx {
  /** 지금 보고 있는 화면 */
  screen: () => 'city' | BuildingId;
  /** 도시 지도 위 건물의 화면 좌표 */
  mapRect: (id: BuildingId) => DOMRect | null;
}

interface Step {
  id: string;
  /** 한 줄 지시문 */
  text: (s: GameState) => string;
  /** 왜 하는지 (작은 글씨) */
  why?: string;
  /** 뚫어 놓을 영역 */
  spot: (ctx: TutorialCtx) => DOMRect | null;
  /** 이게 참이 되면 다음 단계 */
  done: (s: GameState, ctx: TutorialCtx) => boolean;
}

const rect = (sel: string): DOMRect | null => document.querySelector(sel)?.getBoundingClientRect() ?? null;
const unit0 = (s: GameState) => s.businesses.mine.units[0];

const STEPS: Step[] = [
  {
    id: 'enter_mine',
    text: (s) => `${bizName(s, 'mine')}을 누르세요`,
    why: '도시의 모든 건물은 들어갈 수 있습니다',
    spot: (ctx) => ctx.mapRect('mine'),
    done: (_s, ctx) => ctx.screen() === 'mine',
  },
  {
    id: 'tap_unit',
    text: () => '작업터를 눌러 한 번 캐 보세요',
    why: '누를 때마다 한 사이클이 돕니다',
    spot: () => rect('.floor[data-unit="0"]'),
    done: (s) => s.stats.taps >= 3,
  },
  {
    id: 'buy_level',
    text: () => '레벨을 올리세요',
    why: '레벨이 오르면 한 번에 캐는 양이 늘어납니다',
    spot: () => rect('.floor[data-unit="0"] .buy'),
    done: (s) => unit0(s).level >= 3,
  },
  {
    id: 'buy_equip',
    text: () => '설비를 놓으세요',
    why: '설비가 있으면 안 눌러도 절반 속도로 돕니다',
    spot: () => rect('.floor[data-unit="0"] .auto'),
    done: (s) => unit0(s).equip || unit0(s).manager,
  },
  {
    id: 'buy_manager',
    text: () => '사람을 붙이세요',
    why: '이제 완전 자동입니다. 꺼도 계속 돕니다',
    spot: () => rect('.floor[data-unit="0"] .auto'),
    done: (s) => unit0(s).manager,
  },
  {
    id: 'back_city',
    text: () => '도시로 돌아가세요',
    spot: () => rect('.id-chip.back'),
    done: (_s, ctx) => ctx.screen() === 'city',
  },
  {
    id: 'build_housing',
    text: (s) => `건설을 눌러 ${facName(s, 'housing')}을 지으세요`,
    why: '사람이 살아야 작업터가 돌아갑니다',
    spot: () => rect('[data-tut="build"]'),
    done: (s) => (s.facilities[FACILITY_BY_ID.housing.id]?.level ?? 0) > 0,
  },
];

export interface TutorialView {
  root: HTMLElement;
  /** 매 프레임 호출. 위치 갱신 + 단계 진행 */
  update: () => void;
  active: () => boolean;
}

export function createTutorial(game: Game, ctx: TutorialCtx): TutorialView {
  const ring = h('div', { class: 'tut-ring' });
  const textEl = h('div', { class: 'tut-text' }, '');
  const whyEl = h('div', { class: 'tut-why' }, '');
  const skip = h('button', { class: 'tut-skip' }, '건너뛰기');
  const card = h('div', { class: 'tut-card' }, h('div', { class: 'grow' }, textEl, whyEl), skip);
  const root = h('div', { class: 'tut', style: { display: 'none' } }, ring, card);

  skip.addEventListener('click', () => finish('튜토리얼을 건너뛰었습니다'));

  function finish(msg: string): void {
    game.state.tutorial = TUTORIAL_DONE;
    root.style.display = 'none';
    game.persist();
    game.toast(msg);
  }

  function active(): boolean {
    const i = game.state.tutorial;
    return i >= 0 && i < STEPS.length;
  }

  function update(): void {
    if (!active()) {
      if (root.style.display !== 'none') root.style.display = 'none';
      return;
    }
    const s = game.state;
    const step = STEPS[s.tutorial];

    if (step.done(s, ctx)) {
      s.tutorial += 1;
      game.persist();
      if (!active()) {
        finish('이제 알아서 굴러갑니다. 가끔 들러 주세요');
        return;
      }
      return; // 다음 프레임에 새 단계를 그린다
    }

    const r = step.spot(ctx);
    root.style.display = '';
    textEl.textContent = step.text(s);
    whyEl.textContent = step.why ?? '';
    whyEl.style.display = step.why ? '' : 'none';

    if (!r || r.width <= 0) {
      // 대상이 아직 화면에 없다 (전환 중). 링만 숨기고 카드는 남긴다
      ring.style.display = 'none';
      return;
    }
    const pad = 6;
    ring.style.display = '';
    ring.style.left = `${r.left - pad}px`;
    ring.style.top = `${r.top - pad}px`;
    ring.style.width = `${r.width + pad * 2}px`;
    ring.style.height = `${r.height + pad * 2}px`;
    // 카드가 대상을 가리면 위로 올린다
    card.classList.toggle('top', r.top > window.innerHeight * 0.55);
  }

  return { root, update, active };
}
