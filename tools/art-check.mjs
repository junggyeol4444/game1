/**
 * 아트 발주서 / 누락 점검.
 *   node tools/art-check.mjs          — 필요한 스프라이트 목록과 누락 현황
 *   node tools/art-check.mjs --csv    — 외주용 CSV
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const csv = process.argv.includes('--csv');
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

if (csv) {
  console.log('key,설명,파일,상태');
  for (const r of rows) console.log(`${r.key},"${r.note}",${r.file},${r.ok ? 'OK' : '없음'}`);
} else {
  console.log(`\n아트 스프라이트 ${have} / ${rows.length}\n`);
  for (const r of rows) {
    console.log(`  ${r.ok ? '✅' : '⬜'} ${r.key.padEnd(26)} ${r.note}${r.file ? `  → ${r.file}` : ''}`);
  }
  if (have < rows.length) {
    console.log(`\n누락 ${rows.length - have}개. public/art/ 에 파일을 넣고 manifest.json 에 등록하세요.`);
    console.log('자세한 규격: docs/ART.md');
  }
}
