import { fillRR, person, seeded, sparkle, vGradient } from '../scene/gfx';
import type { MgCtx, MinigameDef, MinigameInstance } from './host';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ───────────────────────── 광산: 광맥 캐기 (타이밍 탭) ─────────────────────────
const mineGame: MinigameDef = {
  id: 'mine',
  title: '광맥 캐기',
  howto: '표시 구간에 바늘이 들어왔을 때 화면을 탭하세요. 연속 성공하면 배율이 올라갑니다.',
  create(w, h) {
    let pos = 0;
    let dir = 1;
    let speed = 0.55;
    let zone = 0.24;
    let zoneAt = 0.5;
    let combo = 0;
    let flash = 0;
    let ok = false;
    const chips: { x: number; y: number; vx: number; vy: number; c: string }[] = [];
    const barY = () => h * 0.62;

    const inst: MinigameInstance = {
      score: 0,
      target: 620,
      status: '',
      down() {
        const d = Math.abs(pos - zoneAt);
        if (d <= zone / 2) {
          combo += 1;
          const mult = 1 + Math.min(combo, 12) * 0.25;
          inst.score += 12 * mult;
          zone = Math.max(0.075, zone * 0.94);
          speed = Math.min(2.1, speed * 1.06);
          ok = true;
          for (let i = 0; i < 8; i++) {
            chips.push({
              x: w * 0.5,
              y: h * 0.33,
              vx: (Math.random() - 0.5) * 260,
              vy: -60 - Math.random() * 220,
              c: ['#7fd1c4', '#ffd166', '#c48be0'][i % 3],
            });
          }
        } else {
          combo = 0;
          zone = 0.24;
          speed = Math.max(0.55, speed * 0.9);
          ok = false;
        }
        zoneAt = 0.18 + Math.random() * 0.64;
        flash = 0.3;
      },
      draw({ ctx, t, dt }: MgCtx) {
        pos += dir * speed * dt;
        if (pos > 1) { pos = 1; dir = -1; }
        if (pos < 0) { pos = 0; dir = 1; }
        flash = Math.max(0, flash - dt);
        inst.status = combo > 0 ? `연속 ${combo}회 · 배율 x${(1 + Math.min(combo, 12) * 0.25).toFixed(2)}` : '연속 성공을 노리세요';

        ctx.fillStyle = vGradient(ctx, 0, h, '#4a3a2c', '#241a12');
        ctx.fillRect(0, 0, w, h);
        // 암벽 + 광맥
        const rand = seeded(7);
        for (let i = 0; i < 22; i++) {
          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          ctx.beginPath();
          ctx.ellipse(rand() * w, rand() * h * 0.55, 8 + rand() * 26, 5 + rand() * 12, rand(), 0, 7);
          ctx.fill();
        }
        for (let i = 0; i < 5; i++) {
          ctx.save();
          const col = ['#7fd1c4', '#ffd166', '#c48be0'][i % 3];
          ctx.shadowColor = col;
          ctx.shadowBlur = 12;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(w * (0.2 + i * 0.15), h * (0.2 + Math.sin(t + i) * 0.03), 9, 6, 0.4, 0, 7);
          ctx.fill();
          ctx.restore();
        }
        // 곡괭이 든 광부
        person(ctx, w * 0.5, h * 0.5, h * 0.2, { work: flash > 0 ? 0.25 : t * 0.4, facing: 1, body: '#f4a261' });
        if (flash > 0 && ok) sparkle(ctx, w * 0.5, h * 0.33, 16, '#ffe08a', flash / 0.3);

        // 파편
        for (let i = chips.length - 1; i >= 0; i--) {
          const c = chips[i];
          c.vy += 620 * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          if (c.y > h) { chips.splice(i, 1); continue; }
          ctx.fillStyle = c.c;
          ctx.fillRect(c.x, c.y, 5, 5);
        }

        // 타이밍 바
        const bx = w * 0.08;
        const bw = w * 0.84;
        const by = barY();
        fillRR(ctx, bx, by, bw, h * 0.075, 10, '#141c2e');
        const zx = bx + (zoneAt - zone / 2) * bw;
        fillRR(ctx, zx, by, zone * bw, h * 0.075, 10, 'rgba(74,222,128,0.55)');
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.strokeRect(zx, by, zone * bw, h * 0.075);
        ctx.fillStyle = flash > 0 ? (ok ? '#4ade80' : '#f87171') : '#ffd166';
        ctx.fillRect(bx + pos * bw - 3, by - 8, 6, h * 0.075 + 16);
      },
    };
    return inst;
  },
};

// ───────────────────────── 공장: 분류 라인 (좌/우 탭) ─────────────────────────
const factoryGame: MinigameDef = {
  id: 'factory',
  title: '분류 라인',
  howto: '내려오는 제품을 색에 맞는 통으로. 화면 왼쪽/오른쪽을 탭하세요.',
  create(w, h) {
    interface Item { x: number; y: number; type: 0 | 1; v: number }
    const items: Item[] = [];
    let spawn = 0;
    let rate = 1.15;
    let flash = 0;
    let flashOk = false;
    const COL = ['#5b8def', '#f6b93b'];
    const binY = () => h * 0.8;

    const inst: MinigameInstance = {
      score: 0,
      target: 470,
      status: '',
      down(x) {
        const side = x < w / 2 ? 0 : 1;
        let best: Item | null = null;
        for (const it of items) if (!best || it.y > best.y) best = it;
        if (!best) return;
        if (best.type === side) {
          inst.score += 16;
          flashOk = true;
        } else {
          inst.score = Math.max(0, inst.score - 10);
          flashOk = false;
        }
        flash = 0.22;
        items.splice(items.indexOf(best), 1);
      },
      draw({ ctx, t, dt }: MgCtx) {
        flash = Math.max(0, flash - dt);
        rate = 1.15 + t * 0.05;
        spawn -= dt;
        if (spawn <= 0) {
          spawn = 1 / rate;
          items.push({ x: w * (0.3 + Math.random() * 0.4), y: -20, type: Math.random() < 0.5 ? 0 : 1, v: 90 + t * 4 });
        }

        ctx.fillStyle = vGradient(ctx, 0, h, '#2f4166', '#151d2f');
        ctx.fillRect(0, 0, w, h);
        // 컨베이어
        fillRR(ctx, w * 0.22, 0, w * 0.56, binY(), 0, '#37486d');
        ctx.fillStyle = '#6b81b3';
        const off = (t * 90) % 26;
        for (let y = -off; y < binY(); y += 26) ctx.fillRect(w * 0.24, y, w * 0.52, 5);

        // 통
        for (const s of [0, 1]) {
          const bx = s === 0 ? w * 0.03 : w * 0.65;
          fillRR(ctx, bx, binY(), w * 0.32, h * 0.16, 8, COL[s]);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          fillRR(ctx, bx + 6, binY() + 6, w * 0.32 - 12, h * 0.16 - 12, 6, 'rgba(0,0,0,0.3)');
          ctx.fillStyle = '#0b111c';
          ctx.font = `700 ${Math.round(h * 0.045)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(s === 0 ? '◀ 파랑' : '주황 ▶', bx + w * 0.16, binY() + h * 0.1);
          ctx.textAlign = 'left';
        }

        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.y += it.v * dt;
          if (it.y > binY()) {
            items.splice(i, 1);
            inst.score = Math.max(0, inst.score - 6);
            flash = 0.2;
            flashOk = false;
            continue;
          }
          const s = h * 0.075;
          fillRR(ctx, it.x - s / 2, it.y - s / 2, s, s, 4, COL[it.type]);
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(it.x - s / 2, it.y - s / 2, s, s);
        }

        if (flash > 0) {
          ctx.fillStyle = flashOk ? `rgba(74,222,128,${flash})` : `rgba(248,113,113,${flash})`;
          ctx.fillRect(0, 0, w, h);
        }
        inst.status = `놓치면 감점 · 속도가 점점 빨라집니다`;
      },
    };
    return inst;
  },
};

// ───────────────────────── 어항: 릴링 (홀드) ─────────────────────────
const fisheryGame: MinigameDef = {
  id: 'fishery',
  title: '릴링',
  howto: '화면을 누르면 초록 막대가 올라갑니다. 물고기를 막대 안에 계속 두세요.',
  create(w, h) {
    let barPos = 0.5;
    let barV = 0;
    const barH = 0.26;
    let fish = 0.5;
    let fishV = 0;
    let hold = false;
    let progress = 0;
    let caught = 0;
    let diff = 1;
    let flash = 0;

    const inst: MinigameInstance = {
      score: 0,
      target: 520,
      status: '',
      down() { hold = true; },
      up() { hold = false; },
      draw({ ctx, t, dt }: MgCtx) {
        flash = Math.max(0, flash - dt);
        // 물고기
        fishV += (Math.sin(t * 2.3 * diff) + Math.sin(t * 5.1 * diff + 1.7) * 0.6) * dt * 1.9;
        fishV *= 0.94;
        fish = clamp(fish + fishV * dt, 0.04, 0.96);
        // 막대
        barV += (hold ? -1.55 : 1.15) * dt;
        barV *= 0.9;
        barPos = clamp(barPos + barV, barH / 2, 1 - barH / 2);
        const inZone = Math.abs(fish - barPos) < barH / 2;
        progress = clamp(progress + (inZone ? 0.42 : -0.3) * dt, 0, 1);
        if (inZone) inst.score += 26 * dt;
        if (progress >= 1) {
          caught += 1;
          inst.score += 90;
          progress = 0;
          diff = Math.min(2.4, diff + 0.22);
          fish = 0.5;
          flash = 0.4;
        }
        inst.status = `잡은 물고기 ${caught}마리 · ${inZone ? '물고 있다!' : '놓치는 중'}`;

        ctx.fillStyle = vGradient(ctx, 0, h, '#2a5f86', '#06202f');
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 4; r++) {
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 8) {
            const y = h * 0.1 + r * 26 + Math.sin(x / 30 + t * (1 + r * 0.3)) * 4;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // 레인
        const lx = w * 0.62;
        const lw = w * 0.16;
        fillRR(ctx, lx, h * 0.06, lw, h * 0.86, 12, 'rgba(6,14,24,0.66)');
        // 막대
        fillRR(ctx, lx + 3, h * 0.06 + (barPos - barH / 2) * h * 0.86, lw - 6, barH * h * 0.86, 10, inZone ? 'rgba(74,222,128,0.55)' : 'rgba(120,150,200,0.35)');
        // 물고기
        const fy = h * 0.06 + fish * h * 0.86;
        ctx.fillStyle = flash > 0 ? '#ffe08a' : '#ffd166';
        ctx.beginPath();
        ctx.ellipse(lx + lw / 2, fy, 15, 9, 0, 0, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(lx + lw / 2 + 14, fy);
        ctx.lineTo(lx + lw / 2 + 26, fy - 9);
        ctx.lineTo(lx + lw / 2 + 26, fy + 9);
        ctx.fill();
        ctx.fillStyle = '#1b2740';
        ctx.beginPath();
        ctx.arc(lx + lw / 2 - 6, fy - 2, 2, 0, 7);
        ctx.fill();

        // 진행 게이지
        fillRR(ctx, w * 0.12, h * 0.06, w * 0.09, h * 0.86, 10, 'rgba(6,14,24,0.66)');
        const ph = progress * h * 0.86;
        fillRR(ctx, w * 0.12 + 3, h * 0.06 + h * 0.86 - ph, w * 0.09 - 6, ph, 8, '#4ade80');

        // 낚시꾼
        person(ctx, w * 0.4, h * 0.94, h * 0.24, { phase: hold ? t * 6 : 0, facing: 1, body: '#22a2a2' });
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(w * 0.42, h * 0.72);
        ctx.quadraticCurveTo(w * 0.55, h * 0.4, lx + lw / 2, fy);
        ctx.stroke();
      },
    };
    return inst;
  },
};

// ───────────────────────── 놀이공원: 손님 안내 (드래그) ─────────────────────────
const parkGame: MinigameDef = {
  id: 'park',
  title: '손님 안내',
  howto: '대기 중인 손님을 같은 색 어트랙션으로 끌어다 놓으세요.',
  create(w, h) {
    const COL = ['#f4978e', '#7ee0ff', '#ffd166', '#b8f2a0'];
    interface Guest { x: number; y: number; c: number; patience: number; held: boolean }
    const rides = [0, 1, 2, 3].map((i) => ({
      c: i,
      x: w * 0.72,
      y: h * (0.14 + i * 0.24),
      busy: 0,
    }));
    const guests: Guest[] = [];
    let spawn = 0;
    let drag: Guest | null = null;
    let flash = 0;
    let flashOk = false;

    const inst: MinigameInstance = {
      score: 0,
      target: 430,
      status: '',
      down(x, y) {
        for (const g of guests) {
          if (Math.hypot(g.x - x, g.y - y) < h * 0.09) {
            drag = g;
            g.held = true;
            return;
          }
        }
      },
      move(x, y) {
        if (drag) {
          drag.x = x;
          drag.y = y;
        }
      },
      up(x, y) {
        if (!drag) return;
        const g = drag;
        drag = null;
        g.held = false;
        for (const r of rides) {
          if (Math.hypot(r.x - x, r.y - y) < h * 0.13) {
            if (r.busy > 0) break;
            if (r.c === g.c) {
              inst.score += 22;
              r.busy = 1.5;
              flashOk = true;
            } else {
              inst.score = Math.max(0, inst.score - 10);
              flashOk = false;
            }
            flash = 0.22;
            guests.splice(guests.indexOf(g), 1);
            return;
          }
        }
        g.x = w * 0.14;
        g.y = clamp(g.y, h * 0.12, h * 0.9);
      },
      draw({ ctx, t, dt }: MgCtx) {
        flash = Math.max(0, flash - dt);
        spawn -= dt;
        if (spawn <= 0 && guests.length < 5) {
          spawn = 1.1;
          guests.push({
            x: w * 0.14,
            y: h * (0.16 + guests.length * 0.17),
            c: Math.floor(Math.random() * 4),
            patience: 9,
            held: false,
          });
        }

        ctx.fillStyle = vGradient(ctx, 0, h, '#3f2a63', '#8a5a9c');
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2b7a52';
        ctx.fillRect(0, h * 0.9, w, h * 0.1);
        ctx.fillStyle = 'rgba(201,179,145,0.6)';
        ctx.fillRect(w * 0.24, 0, w * 0.38, h);

        // 어트랙션
        for (const r of rides) {
          r.busy = Math.max(0, r.busy - dt);
          ctx.save();
          ctx.translate(r.x, r.y);
          ctx.strokeStyle = COL[r.c];
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, h * 0.085, 0, 7);
          ctx.stroke();
          const sp = r.busy > 0 ? t * 8 : t * 1.2;
          for (let i = 0; i < 6; i++) {
            const a = sp + (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * h * 0.085, Math.sin(a) * h * 0.085);
            ctx.stroke();
          }
          ctx.fillStyle = COL[r.c];
          ctx.beginPath();
          ctx.arc(0, 0, h * 0.022, 0, 7);
          ctx.fill();
          if (r.busy > 0) {
            ctx.fillStyle = 'rgba(74,222,128,0.9)';
            ctx.font = `700 ${Math.round(h * 0.035)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('이용 중', 0, h * 0.125);
            ctx.textAlign = 'left';
          }
          ctx.restore();
        }

        // 손님
        for (let i = guests.length - 1; i >= 0; i--) {
          const g = guests[i];
          if (!g.held) g.patience -= dt;
          if (g.patience <= 0) {
            guests.splice(i, 1);
            inst.score = Math.max(0, inst.score - 14);
            flash = 0.22;
            flashOk = false;
            continue;
          }
          ctx.fillStyle = 'rgba(6,10,20,0.35)';
          ctx.beginPath();
          ctx.ellipse(g.x, g.y + h * 0.055, 13, 4, 0, 0, 7);
          ctx.fill();
          person(ctx, g.x, g.y + h * 0.055, h * 0.115, { phase: t * 2 + i, facing: 1, body: COL[g.c] });
          // 인내심
          const pw = 30;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(g.x - pw / 2, g.y - h * 0.085, pw, 4);
          ctx.fillStyle = g.patience > 3 ? '#4ade80' : '#f87171';
          ctx.fillRect(g.x - pw / 2, g.y - h * 0.085, (pw * g.patience) / 9, 4);
        }

        if (flash > 0) {
          ctx.fillStyle = flashOk ? `rgba(74,222,128,${flash})` : `rgba(248,113,113,${flash})`;
          ctx.fillRect(0, 0, w, h);
        }
        inst.status = `대기 ${guests.length}명 · 오래 기다리면 떠납니다`;
      },
    };
    return inst;
  },
};

// ───────────────────────── 기업: 거래 (저점 매수 고점 매도) ─────────────────────────
const corpGame: MinigameDef = {
  id: 'corp',
  title: '거래',
  howto: '싸게 사서 비싸게 파세요. 아래 버튼을 탭합니다.',
  create(w, h) {
    const hist: number[] = [];
    let price = 100;
    let vel = 0;
    let holding = false;
    let entry = 0;
    let flash = 0;
    let flashOk = false;
    let trades = 0;
    const btnY = () => h * 0.84;

    const inst: MinigameInstance = {
      score: 0,
      target: 780,
      status: '',
      down(_x, y) {
        if (y < btnY()) return;
        if (!holding) {
          holding = true;
          entry = price;
          flash = 0.2;
          flashOk = true;
        } else {
          const profit = (price - entry) * 2.2;
          inst.score = Math.max(0, inst.score + profit);
          holding = false;
          trades += 1;
          flash = 0.25;
          flashOk = profit >= 0;
        }
      },
      draw({ ctx, t, dt }: MgCtx) {
        flash = Math.max(0, flash - dt);
        vel += (Math.sin(t * 1.7) * 0.7 + (Math.random() - 0.5) * 2.4) * dt * 26;
        vel *= 0.93;
        price = clamp(price + vel * dt, 30, 190);
        hist.push(price);
        if (hist.length > 90) hist.shift();

        ctx.fillStyle = vGradient(ctx, 0, h, '#1d2440', '#0d1120');
        ctx.fillRect(0, 0, w, h);
        // 그리드
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(0, (h * 0.78 * i) / 5);
          ctx.lineTo(w, (h * 0.78 * i) / 5);
          ctx.stroke();
        }
        const py = (p: number) => h * 0.72 - ((p - 30) / 160) * h * 0.62;
        // 진입가
        if (holding) {
          ctx.strokeStyle = 'rgba(255,209,102,0.8)';
          ctx.setLineDash([6, 5]);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, py(entry));
          ctx.lineTo(w, py(entry));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // 가격선
        ctx.strokeStyle = holding ? (price >= entry ? '#4ade80' : '#f87171') : '#7ee0ff';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        hist.forEach((p, i) => {
          const x = (i / 89) * w;
          i === 0 ? ctx.moveTo(x, py(p)) : ctx.lineTo(x, py(p));
        });
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.arc(w * (hist.length - 1) / 89, py(price), 5, 0, 7);
        ctx.fill();

        ctx.fillStyle = '#eaf1ff';
        ctx.font = `800 ${Math.round(h * 0.06)}px system-ui, sans-serif`;
        ctx.fillText(`₩${price.toFixed(1)}`, 12, h * 0.1);
        if (holding) {
          const p = (price - entry) * 2.2;
          ctx.fillStyle = p >= 0 ? '#4ade80' : '#f87171';
          ctx.font = `700 ${Math.round(h * 0.045)}px system-ui, sans-serif`;
          ctx.fillText(`평가손익 ${p >= 0 ? '+' : ''}${p.toFixed(0)}`, 12, h * 0.17);
        }

        // 버튼
        fillRR(ctx, w * 0.06, btnY(), w * 0.88, h * 0.12, 12, holding ? '#e08a1e' : '#2f5fc4');
        ctx.fillStyle = holding ? '#2a1c02' : '#eaf1ff';
        ctx.font = `800 ${Math.round(h * 0.055)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(holding ? '매도' : '매수', w * 0.5, btnY() + h * 0.079);
        ctx.textAlign = 'left';

        if (flash > 0) {
          ctx.fillStyle = flashOk ? `rgba(74,222,128,${flash})` : `rgba(248,113,113,${flash})`;
          ctx.fillRect(0, 0, w, h);
        }
        inst.status = `거래 ${trades}회 · ${holding ? '보유 중' : '관망 중'}`;
      },
    };
    return inst;
  },
};

export const MINIGAMES: Record<string, MinigameDef> = {
  mine: mineGame,
  factory: factoryGame,
  fishery: fisheryGame,
  park: parkGame,
  corp: corpGame,
};

/** 미니게임으로만 얻는 특산물 (기획서 7장) */
export const MINIGAME_SPOILS: Record<string, { key: 'gems' | 'specs' | 'satisfaction' | 'funds' | 'fish'; label: string; icon: string }> = {
  mine: { key: 'gems', label: '보석', icon: '💎' },
  factory: { key: 'specs', label: '고급 규격품', icon: '🔩' },
  fishery: { key: 'fish', label: '희귀 어종', icon: '🐠' },
  park: { key: 'satisfaction', label: '만족도', icon: '💗' },
  corp: { key: 'funds', label: '투자 자금', icon: '💼' },
};

export const RARE_FISH = ['참돔', '방어', '광어', '전복', '대게', '다랑어', '개복치', '심해 아귀', '황금 잉어'];
