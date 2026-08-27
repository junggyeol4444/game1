/**
 * 화면 타격감 (아트 문서 9장).
 * 애니메이션 줄이기 설정이 켜져 있으면 전부 no-op 이다.
 */
export type ShakeLevel = 'tap' | 'hit' | 'quake';

const CLASS: Record<ShakeLevel, string> = { tap: 'sh-tap', hit: 'sh-hit', quake: 'sh-quake' };
const MS: Record<ShakeLevel, number> = { tap: 90, hit: 220, quake: 900 };

export function shake(el: HTMLElement | null, level: ShakeLevel, reducedMotion: boolean): void {
  if (!el || reducedMotion) return;
  const cls = CLASS[level];
  el.classList.remove(cls);
  // 같은 클래스를 연속으로 붙일 때 애니메이션을 다시 시작시킨다
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), MS[level]);
}
