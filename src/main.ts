import './styles.css';
import { Game } from './core/game';
import { WebStubAdProvider, type AdResult } from './core/ads';
import { StubPurchaseProvider } from './core/iap';
import { mountApp } from './ui/app';
import { loadArt, manifestSize } from './ui/art/assets';
import { h, qs } from './ui/dom';

/**
 * 웹/개발 빌드용 광고 스텁.
 * 스토어 빌드에서는 Capacitor AdMob / AppLovin MAX 어댑터로 교체한다 (docs/NATIVE.md).
 */
function showStubAd(seconds: number, placement: string): Promise<AdResult> {
  return new Promise((resolve) => {
    let remain = seconds;
    const counter = h('div', { class: 'muted' }, '');
    const closeBtn = h(
      'button',
      {
        class: 'ghost',
        disabled: true,
        onclick: () => {
          overlay.remove();
          clearInterval(timer);
          resolve('completed');
        },
      },
      '보상 받기',
    );
    const skip = h(
      'button',
      {
        class: 'ghost small',
        onclick: () => {
          overlay.remove();
          clearInterval(timer);
          resolve('skipped');
        },
      },
      '닫기 (보상 없음)',
    );
    const overlay = h(
      'div',
      { class: 'adstub' },
      h('div', { class: 'box' }, '📺'),
      h('div', null, `광고 (${placement})`),
      counter,
      closeBtn,
      skip,
    );
    const tick = () => {
      counter.textContent = remain > 0 ? `${remain}초 후 보상` : '시청 완료';
      closeBtn.disabled = remain > 0;
      if (remain <= 0) clearInterval(timer);
      remain -= 1;
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.body.appendChild(overlay);
  });
}

const game = new Game(new WebStubAdProvider((sec, placement) => showStubAd(sec, placement)));
game.purchases = new StubPurchaseProvider(async (sku) => {
  // 개발 빌드: 실제 결제 대신 확인창. 네이티브에서는 스토어 결제 플러그인으로 교체.
  return confirm(`[개발용] ${sku} 결제를 진행할까요?\n실제 결제는 발생하지 않습니다.`);
});

// 아트 팩을 먼저 불러온다. 없으면 플레이스홀더로 뜬다 (docs/ART.md)
void loadArt().then(() => {
  if (manifestSize() === 0) {
    console.info('[art] public/art/manifest.json 에 등록된 스프라이트가 없습니다 — 플레이스홀더로 표시합니다.');
  }
});

mountApp(game, qs('#app'));
game.start();

// 디버그 콘솔용
(window as unknown as Record<string, unknown>).game = game;
