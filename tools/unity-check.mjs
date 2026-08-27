import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('unity');
const required = [
  'Packages/manifest.json',
  'ProjectSettings/ProjectVersion.txt',
  'Assets/Scripts/Core/GameModels.cs',
  'Assets/Scripts/Core/EconomyService.cs',
  'Assets/Scripts/Core/LocalSaveService.cs',
  'Assets/Scripts/Core/FacilityService.cs',
  'Assets/Scripts/Core/EraService.cs',
  'Assets/Scripts/Core/MonetizationService.cs',
  'Assets/Scripts/Runtime/CityIdleGame.cs',
  'Assets/Scripts/Runtime/RuntimeBootstrap.cs',
];

for (const relative of required) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Unity 필수 파일 누락: ${relative}`);
}
JSON.parse(fs.readFileSync(path.join(root, 'Packages/manifest.json'), 'utf8'));

for (const relative of required.filter((file) => file.endsWith('.cs'))) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const opens = [...source].filter((ch) => ch === '{').length;
  const closes = [...source].filter((ch) => ch === '}').length;
  if (opens !== closes) throw new Error(`${relative}: 중괄호 ${opens}/${closes}`);
  if (/Capacitor|WebView|TypeScript/.test(source)) throw new Error(`${relative}: 웹 런타임 참조가 들어갔습니다`);
}

const runtime = fs.readFileSync(path.join(root, 'Assets/Scripts/Runtime/RuntimeBootstrap.cs'), 'utf8');
for (const token of ['RuntimeInitializeOnLoadMethod', 'CitizenMover', 'CanvasScaler', 'BuildCity', 'unitIndex < 12', 'Panel(', 'BuyFacility', 'AdvanceEra']) {
  if (!runtime.includes(token)) throw new Error(`Unity 런타임 구성 누락: ${token}`);
}
const economy = fs.readFileSync(path.join(root, 'Assets/Scripts/Core/EconomyService.cs'), 'utf8');
for (const token of ['state.cityLevel < def.UnlockLevel', 'unit.running = true', 'ChainEfficiency', 'row.UnlockCost']) {
  if (!economy.includes(token)) throw new Error(`Unity 경제 안전장치 누락: ${token}`);
}
const models = fs.readFileSync(path.join(root, 'Assets/Scripts/Core/GameModels.cs'), 'utf8');
for (const token of ['FacilityId', 'EraNames', 'Normalize(GameState']) {
  if (!models.includes(token)) throw new Error(`Unity 상태 마이그레이션 누락: ${token}`);
}
const monetization = fs.readFileSync(path.join(root, 'Assets/Scripts/Core/MonetizationService.cs'), 'utf8');
for (const token of ['#if UNITY_EDITOR', 'DisabledMonetizationService', 'Task.FromResult(false)']) {
  if (!monetization.includes(token)) throw new Error(`Unity 수익화 안전장치 누락: ${token}`);
}
console.log(`Unity 프로젝트 정적 검사 통과 (${required.length}개 필수 파일)`);
