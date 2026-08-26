/**
 * 아트 발주서 / 누락 점검.
 *   node tools/art-check.mjs          — 필수 스프라이트 목록과 누락 현황
 *   node tools/art-check.mjs --all    — 시대 전용(선택) 변형까지 전부
 *   node tools/art-check.mjs --csv    — 외주용 CSV (선택 항목 포함)
 *
 * 필수 = 시대 공통 키. 시대 전용 키가 없으면 게임이 여기로 떨어지므로 이것만 있으면 돌아간다.
 * 선택 = `buildings/<시대id>/…` 처럼 그 문명에서만 쓰는 변형.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const csv = process.argv.includes('--csv');
const showAll = process.argv.includes('--all');
const specJson = execSync(
  'npx tsx -e "import {requiredSprites} from \'./src/ui/art/keys.ts\'; console.log(JSON.stringify(requiredSprites()))"',
  { encoding: 'utf8' },
).trim();
const specs = JSON.parse(specJson.split('\n').pop());

let manifest = { sprites: {} };
let manifestError = '';
if (existsSync('public/art/manifest.json')) {
  try {
    manifest = JSON.parse(readFileSync('public/art/manifest.json', 'utf8'));
    if (!manifest || typeof manifest !== 'object') throw new Error('최상위가 객체가 아닙니다');
    if (!manifest.sprites || typeof manifest.sprites !== 'object') {
      throw new Error("'sprites' 항목이 없습니다");
    }
  } catch (e) {
    manifestError = e.message;
    manifest = { sprites: {} };
  }
}

let have = 0;
const rows = specs.map((s) => {
  const entry = manifest.sprites?.[s.key];
  const file = entry?.file ?? '';
  const ok = Boolean(file) && existsSync(`public/art/${file}`);
  if (ok) have += 1;
  return { ...s, file, ok };
});

const required = rows.filter((r) => !r.optional);
const optional = rows.filter((r) => r.optional);
const count = (list) => list.filter((r) => r.ok).length;

// manifest 쪽 문제 — 등록했는데 게임이 안 쓰거나, 파일이 없는 경우.
// 아트를 넣고 나서 "왜 회색 상자만 나오지" 하는 원인 대부분이 여기다 (키 오타).
const knownKeys = new Set(specs.map((s) => s.key));
const manifestProblems = [];
for (const [key, entry] of Object.entries(manifest.sprites ?? {})) {
  if (!knownKeys.has(key)) {
    manifestProblems.push(`❓ ${key} — 게임이 안 쓰는 키입니다 (오타?)`);
    continue;
  }
  const file = entry?.file;
  if (!file) manifestProblems.push(`⚠ ${key} — 'file' 이 비어 있습니다`);
  else if (!existsSync(`public/art/${file}`)) {
    manifestProblems.push(`⚠ ${key} — 파일이 없습니다: public/art/${file}`);
  }
  for (const [f, lo, hi] of [['anchorX', 0, 1], ['anchorY', 0, 1], ['scale', 0.01, 20]]) {
    const v = entry?.[f];
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)) {
      manifestProblems.push(`⚠ ${key} — ${f} 가 범위를 벗어났습니다: ${v} (${lo}~${hi})`);
    }
  }
}

if (csv) {
  console.log('key,설명,파일,필수,상태');
  for (const r of rows) {
    console.log(`${r.key},"${r.note}",${r.file},${r.optional ? '선택' : '필수'},${r.ok ? 'OK' : '없음'}`);
  }
} else {
  const line = (r) => `  ${r.ok ? '✅' : '⬜'} ${r.key.padEnd(28)} ${r.note}${r.file ? `  → ${r.file}` : ''}`;
  console.log(`\n필수 (시대 공통) ${count(required)} / ${required.length}\n`);
  for (const r of required) console.log(line(r));

  console.log(`\n선택 (시대 전용) ${count(optional)} / ${optional.length}`);
  if (showAll) {
    console.log('');
    for (const r of optional) console.log(line(r));
  } else {
    console.log('  없어도 시대 공통 키로 자동 대체됩니다. 전체 목록은 --all');
  }

  if (manifestError) {
    console.log(`\n❌ manifest.json 을 읽지 못했습니다: ${manifestError}`);
    console.log('   JSON 문법과 최상위 sprites 항목을 확인하세요.');
  }
  if (manifestProblems.length) {
    console.log(`\nmanifest 문제 ${manifestProblems.length}건`);
    for (const m of manifestProblems) console.log(`  ${m}`);
  }

  const miss = required.length - count(required);
  if (miss > 0) {
    console.log(`\n필수 누락 ${miss}개. public/art/ 에 파일을 넣고 manifest.json 에 등록하세요.`);
    console.log('자세한 규격: docs/ART.md');
  }

  // 필수가 빠지거나 manifest 가 깨지면 화면이 회색 상자가 된다.
  // 조용히 통과시키면 CI 를 붙인 의미가 없으므로 실패로 끝낸다.
  if (miss > 0 || manifestError || manifestProblems.length) process.exitCode = 1;
}
