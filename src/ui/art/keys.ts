import { BUSINESSES } from '../../data/businesses';
import { BUSINESS_TIERS, FACILITIES, type BuildingId } from '../../data/buildings';

/**
 * 게임이 요구하는 스프라이트 키 목록.
 * 이 목록이 곧 아트 발주서다 — `npm run art:check` 로 빠진 것을 확인한다.
 */
export interface SpriteSpec {
  key: string;
  /** 아트 담당에게 주는 설명 */
  note: string;
}

export function buildingKey(id: BuildingId, tier: number): string {
  return `buildings/${id}_${tier}`;
}

export function requiredSprites(): SpriteSpec[] {
  const out: SpriteSpec[] = [];

  for (const b of BUSINESSES) {
    const tiers = BUSINESS_TIERS[b.id];
    for (let t = 1; t < tiers.length; t++) {
      out.push({ key: buildingKey(b.id, t), note: `${b.name} ${t}단계 — ${tiers[t]}` });
    }
  }
  for (const f of FACILITIES) {
    for (let t = 1; t < f.tiers.length; t++) {
      out.push({ key: buildingKey(f.id, t), note: `${f.name} ${t}단계 — ${f.tiers[t]}` });
    }
  }

  out.push({ key: 'ground/grass', note: '잔디 타일 (아이소 다이아몬드)' });
  out.push({ key: 'ground/grass_alt', note: '잔디 타일 변형 (체크 패턴용)' });
  out.push({ key: 'ground/dirt', note: '흙길 타일 (도로 Lv.0)' });
  out.push({ key: 'ground/road', note: '포장 도로 타일' });
  out.push({ key: 'ground/road_line', note: '차선 있는 도로 타일' });
  out.push({ key: 'ground/water', note: '물 타일' });
  out.push({ key: 'ground/empty', note: '빈 부지 타일 (울타리 포함)' });

  out.push({ key: 'props/tree', note: '나무' });
  out.push({ key: 'props/car_a', note: '차량 (가로 방향)' });
  out.push({ key: 'props/car_b', note: '차량 (세로 방향)' });
  out.push({ key: 'props/citizen', note: '시민 (2.5등신, 걷기 1프레임)' });
  out.push({ key: 'props/worker', note: '작업자 (안전모)' });

  return out;
}

export const REQUIRED_KEYS = requiredSprites().map((s) => s.key);
