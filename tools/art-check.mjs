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
if (existsSync('public/art/manifest.json')) {
  manifest = JSON.parse(readFileSync('public/art/manifest.json', 'utf8'));
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

  const miss = required.length - count(required);
  if (miss > 0) {
    console.log(`\n필수 누락 ${miss}개. public/art/ 에 파일을 넣고 manifest.json 에 등록하세요.`);
    console.log('자세한 규격: docs/ART.md');
  }
}
