import { BUSINESSES } from '../../data/businesses';
import { BUSINESS_TIERS, FACILITIES, type BuildingId } from '../../data/buildings';
import { ERAS } from '../../data/eras';

/**
 * 게임이 요구하는 스프라이트 키 목록.
 * 이 목록이 곧 아트 발주서다 — `npm run art:check` 로 빠진 것을 확인한다.
 */
export interface SpriteSpec {
  key: string;
  /** 아트 담당에게 주는 설명 */
  note: string;
  /**
   * 시대 전용 변형. 없으면 시대 공통 키로 자동 대체되므로 게임은 돌아간다.
   * (`npm run art:check` 가 필수/선택을 나눠서 보여준다)
   */
  optional?: boolean;
}

/** 시대 공통 키 — 시대 전용 스프라이트가 없을 때 쓰는 대체본 */
export function buildingKey(id: BuildingId, tier: number): string {
  return `buildings/${id}_${tier}`;
}

/**
 * 그릴 때 시도할 키 순서: 이 시대 전용 -> 시대 공통.
 * 문명이 바뀌면 같은 부지에 완전히 다른 건물이 서야 하므로 시대별 키를 먼저 본다.
 */
export function buildingKeysFor(eraId: string, id: BuildingId, tier: number): [string, string] {
  return [`buildings/${eraId}/${id}_${tier}`, buildingKey(id, tier)];
}

export function tileKeysFor(eraId: string, key: string): [string, string] {
  const slash = key.indexOf('/');
  return [`${key.slice(0, slash)}/${eraId}/${key.slice(slash + 1)}`, key];
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

  // 시대 전용 변형 (선택) — 있으면 그 시대에만 쓰인다
  const base = out.map((o) => o.key);
  for (const era of ERAS) {
    for (const key of base) {
      const slash = key.indexOf('/');
      out.push({
        key: `${key.slice(0, slash)}/${era.id}/${key.slice(slash + 1)}`,
        note: `${era.name} 전용 — ${key}`,
        optional: true,
      });
    }
  }

  return out;
}

export const REQUIRED_KEYS = requiredSprites().filter((s) => !s.optional).map((s) => s.key);
export const OPTIONAL_KEYS = requiredSprites().filter((s) => s.optional).map((s) => s.key);
