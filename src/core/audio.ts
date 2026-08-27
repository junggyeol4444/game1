/**
 * 효과음 + 배경음 (아트 문서 10장).
 *
 * 음원 파일을 쓰지 않고 WebAudio 로 합성한다.
 *  - 에셋 0개 · 용량 0 · 로딩 0. 1인 개발이라 음원 발주 대신 코드로 만든다.
 *  - 톤이 마음에 안 들면 여기 숫자만 고치면 된다. 나중에 실제 음원으로 갈아끼울 때는
 *    play() 안쪽만 파일 재생으로 바꾸면 호출부는 그대로다.
 *
 * 규칙:
 *  - AudioContext 는 첫 사용자 입력 때 만든다 (브라우저 자동재생 정책).
 *  - 자동화가 돌면 사이클 완료가 초당 수백 번 난다. 큐마다 초당 횟수를 제한한다.
 *  - settings.sound 가 꺼져 있으면 컨텍스트를 아예 만들지 않는다.
 */

export type Sfx =
  | 'tap'        // 곡괭이질 (수동 가동)
  | 'cycle'      // 사이클 완료 · 적재
  | 'buy'        // 레벨업
  | 'equip'      // 설비 배치
  | 'manager'    // 사람 배치
  | 'build'      // 건물 완공
  | 'unlock'     // 신규 해금
  | 'milestone'  // 마일스톤 돌파
  | 'coin'       // 현금 획득
  | 'reward'     // 보상 수령 · 광고 완료
  | 'era'        // 문명 전환
  | 'deny'       // 자금 부족
  | 'mgTick'     // 미니게임 카운트다운
  | 'mgStart'    // 미니게임 시작
  | 'mgPerfect'  // 정타
  | 'mgGood'     // 근접
  | 'mgMiss'     // 빗나감
  | 'mgCombo'    // 콤보 단계 상승
  | 'mgEnd';     // 미니게임 종료

interface Cue {
  /** 초당 최대 재생 횟수. 자동화 폭주를 막는다 */
  limit: number;
  gain: number;
  play: (ctx: AudioContext, out: GainNode, t: number) => void;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let unlocked = false;
let bgmTimer: ReturnType<typeof setTimeout> | null = null;
let bgmBus: GainNode | null = null;
const lastAt = new Map<Sfx, number[]>();

/** 설정에서 호출. 끄면 재생 중인 것도 즉시 멈춘다 */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (master) master.gain.value = on ? 0.5 : 0;
  if (on && ctx && master) startBgm();
  if (!on && bgmTimer !== null) {
    clearTimeout(bgmTimer);
    bgmTimer = null;
  }
  if (!on && bgmBus) {
    bgmBus.disconnect();
    bgmBus = null;
  }
}

/**
 * 첫 사용자 입력에서 한 번 호출한다.
 * 이 시점 전에 AudioContext 를 만들면 브라우저가 suspended 로 잡아 둔다.
 */
export function unlockAudio(): void {
  if (unlocked || !enabled) return;
  unlocked = true;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
    startBgm();
  } catch {
    ctx = null; // 오디오를 못 쓰는 환경 — 조용히 포기한다
  }
}

// ── 배경음 ──────────────────────────────────────────────────
// 8마디를 한꺼번에 예약해서 메인 루프가 잠깐 밀려도 박자가 흔들리지 않는다.
// 짧은 삼각파만 써서 별도 음원 다운로드와 디코딩 비용은 없다.
const BGM_STEP_SECONDS = 0.48;
const BGM_MELODY = [0, 4, 7, 4, 2, 5, 9, 5, -2, 2, 5, 2, 0, 4, 7, 9] as const;
const BGM_ROOTS = [131, 110, 98, 123] as const;

function scheduleBgm(): void {
  if (!enabled || !ctx || !master) return;
  const start = ctx.currentTime + 0.08;
  const bgm = ctx.createGain();
  bgm.gain.value = 0.075;
  bgm.connect(master);
  bgmBus = bgm;

  BGM_MELODY.forEach((semitone, i) => {
    const root = BGM_ROOTS[Math.floor(i / 4) % BGM_ROOTS.length];
    const at = start + i * BGM_STEP_SECONDS;
    tone(ctx!, bgm, at, {
      freq: root * 2 * Math.pow(2, semitone / 12),
      dur: BGM_STEP_SECONDS * 0.78,
      type: 'triangle',
      gain: 0.12,
    });
    if (i % 4 === 0) {
      tone(ctx!, bgm, at, { freq: root, dur: BGM_STEP_SECONDS * 3.5, type: 'sine', gain: 0.09 });
    }
  });

  const loopMs = BGM_MELODY.length * BGM_STEP_SECONDS * 1000;
  bgmTimer = setTimeout(() => {
    bgm.disconnect();
    if (bgmBus === bgm) bgmBus = null;
    bgmTimer = null;
    scheduleBgm();
  }, loopMs);
}

function startBgm(): void {
  if (bgmTimer !== null || !enabled || !ctx || !master) return;
  scheduleBgm();
}

// ── 파형 조각 ────────────────────────────────────────────────
function tone(
  ctx: AudioContext,
  out: GainNode,
  t: number,
  opts: { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number; delay?: number },
): void {
  const at = t + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, at);
  if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), at + opts.dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
  osc.connect(g);
  g.connect(out);
  osc.start(at);
  osc.stop(at + opts.dur + 0.02);
}

/** 짧은 노이즈 — 곡괭이질 · 흙 · 먼지 */
function noise(
  ctx: AudioContext,
  out: GainNode,
  t: number,
  opts: { dur: number; gain?: number; cutoff?: number; delay?: number },
): void {
  const at = t + (opts.delay ?? 0);
  const n = Math.max(1, Math.floor(ctx.sampleRate * opts.dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = opts.cutoff ?? 2200;
  const g = ctx.createGain();
  g.gain.value = opts.gain ?? 0.25;
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  src.start(at);
}

/** 콤보 음을 반음씩 올리기 위한 현재 주파수 */
let comboFreq = 523;

/** 콤보 단계(1부터)를 주면 그만큼 음이 올라간다. 0 이면 기본으로 되돌린다 */
export function setComboStep(step: number): void {
  comboFreq = 523 * Math.pow(2, Math.max(0, Math.min(24, step)) / 12);
}

const CUES: Record<Sfx, Cue> = {
  // 곡괭이가 돌에 맞는 소리 — 노이즈 한 방 + 낮은 몸통
  tap: {
    limit: 14,
    gain: 1,
    play: (c, o, t) => {
      noise(c, o, t, { dur: 0.07, gain: 0.3, cutoff: 3200 });
      tone(c, o, t, { freq: 180, to: 90, dur: 0.09, type: 'triangle', gain: 0.22 });
    },
  },
  // 한 사이클 적재 — 아주 짧고 작게. 자동화 시 계속 난다
  cycle: {
    limit: 8,
    gain: 1,
    play: (c, o, t) => tone(c, o, t, { freq: 520, to: 700, dur: 0.06, type: 'sine', gain: 0.1 }),
  },
  buy: {
    limit: 10,
    gain: 1,
    play: (c, o, t) => {
      tone(c, o, t, { freq: 520, dur: 0.07, type: 'square', gain: 0.13 });
      tone(c, o, t, { freq: 780, dur: 0.1, type: 'square', gain: 0.11, delay: 0.05 });
    },
  },
  equip: {
    limit: 4,
    gain: 1,
    play: (c, o, t) => {
      noise(c, o, t, { dur: 0.12, gain: 0.2, cutoff: 1400 });
      tone(c, o, t, { freq: 300, to: 460, dur: 0.16, type: 'sawtooth', gain: 0.14 });
    },
  },
  manager: {
    limit: 4,
    gain: 1,
    play: (c, o, t) => {
      [440, 587, 740].forEach((f, i) => tone(c, o, t, { freq: f, dur: 0.14, type: 'triangle', gain: 0.16, delay: i * 0.055 }));
    },
  },
  build: {
    limit: 4,
    gain: 1,
    play: (c, o, t) => {
      noise(c, o, t, { dur: 0.22, gain: 0.32, cutoff: 900 });
      tone(c, o, t, { freq: 130, to: 70, dur: 0.26, type: 'triangle', gain: 0.28 });
      tone(c, o, t, { freq: 660, dur: 0.12, type: 'sine', gain: 0.12, delay: 0.16 });
    },
  },
  unlock: {
    limit: 3,
    gain: 1,
    play: (c, o, t) => {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(c, o, t, { freq: f, dur: 0.22, type: 'triangle', gain: 0.16, delay: i * 0.07 }),
      );
    },
  },
  milestone: {
    limit: 3,
    gain: 1,
    play: (c, o, t) => {
      [784, 988, 1319].forEach((f, i) => tone(c, o, t, { freq: f, dur: 0.3, type: 'sine', gain: 0.15, delay: i * 0.04 }));
    },
  },
  coin: {
    limit: 6,
    gain: 1,
    play: (c, o, t) => {
      tone(c, o, t, { freq: 1180, dur: 0.06, type: 'square', gain: 0.09 });
      tone(c, o, t, { freq: 1560, dur: 0.09, type: 'square', gain: 0.07, delay: 0.045 });
    },
  },
  reward: {
    limit: 3,
    gain: 1,
    play: (c, o, t) => {
      [659, 784, 1047, 1319].forEach((f, i) =>
        tone(c, o, t, { freq: f, dur: 0.26, type: 'sine', gain: 0.15, delay: i * 0.06 }),
      );
    },
  },
  // 문명 전환 — 무너지는 소리 뒤에 새 문명이 서는 화음
  era: {
    limit: 1,
    gain: 1,
    play: (c, o, t) => {
      noise(c, o, t, { dur: 0.9, gain: 0.34, cutoff: 700 });
      tone(c, o, t, { freq: 160, to: 55, dur: 0.9, type: 'sawtooth', gain: 0.2 });
      [262, 330, 392, 523].forEach((f, i) =>
        tone(c, o, t, { freq: f, dur: 1.1, type: 'triangle', gain: 0.15, delay: 0.85 + i * 0.09 }),
      );
    },
  },
  // ── 미니게임 ──
  mgTick: { limit: 4, gain: 1, play: (c, o, t) => tone(c, o, t, { freq: 660, dur: 0.09, type: 'square', gain: 0.12 }) },
  mgStart: {
    limit: 2,
    gain: 1,
    play: (c, o, t) => {
      tone(c, o, t, { freq: 880, dur: 0.16, type: 'square', gain: 0.16 });
      tone(c, o, t, { freq: 1320, dur: 0.2, type: 'square', gain: 0.13, delay: 0.08 });
    },
  },
  // 정타는 짧고 높고 확실하게. 이게 이 게임의 손맛이다
  mgPerfect: {
    limit: 20,
    gain: 1,
    play: (c, o, t) => {
      tone(c, o, t, { freq: 1046, to: 1568, dur: 0.09, type: 'square', gain: 0.16 });
      noise(c, o, t, { dur: 0.05, gain: 0.14, cutoff: 5000 });
    },
  },
  mgGood: { limit: 20, gain: 1, play: (c, o, t) => tone(c, o, t, { freq: 740, dur: 0.08, type: 'triangle', gain: 0.13 }) },
  mgMiss: { limit: 20, gain: 1, play: (c, o, t) => tone(c, o, t, { freq: 300, to: 170, dur: 0.14, type: 'sawtooth', gain: 0.11 }) },
  // 콤보가 오를 때마다 반음씩 올라간다 — 연속 정타가 소리로 쌓인다
  mgCombo: {
    limit: 12,
    gain: 1,
    play: (c, o, t) => tone(c, o, t, { freq: comboFreq, dur: 0.12, type: 'sine', gain: 0.15 }),
  },
  mgEnd: {
    limit: 2,
    gain: 1,
    play: (c, o, t) => {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(c, o, t, { freq: f, dur: 0.3, type: 'triangle', gain: 0.15, delay: i * 0.07 }),
      );
    },
  },
  deny: {
    limit: 4,
    gain: 1,
    play: (c, o, t) => tone(c, o, t, { freq: 220, to: 150, dur: 0.16, type: 'square', gain: 0.12 }),
  },
};

/** 초당 재생 횟수 제한 */
function allowed(key: Sfx, limit: number, now: number): boolean {
  const arr = lastAt.get(key) ?? [];
  const recent = arr.filter((v) => now - v < 1000);
  if (recent.length >= limit) {
    lastAt.set(key, recent);
    return false;
  }
  recent.push(now);
  lastAt.set(key, recent);
  return true;
}

export function sfx(key: Sfx): void {
  if (!enabled || !ctx || !master) return;
  const cue = CUES[key];
  if (!cue) return;
  if (!allowed(key, cue.limit, performance.now())) return;
  if (ctx.state === 'suspended') void ctx.resume();
  try {
    cue.play(ctx, master, ctx.currentTime);
  } catch {
    /* 오디오 실패가 게임을 멈추면 안 된다 */
  }
}

/** 테스트/디버그용 */
export function audioReady(): boolean {
  return Boolean(ctx);
}
