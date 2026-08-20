import type { BusinessId, GameState } from './types';

export type IapId = 'starter' | 'piggy' | 'tabBoost' | 'adFree' | 'redevelop';

export interface IapProduct {
  id: IapId;
  /** 스토어 상품 ID (Play/App Store 등록용) */
  sku: string;
  title: string;
  desc: string;
  icon: string;
  priceLabel: string;
  oneTime: boolean;
  /** 가격을 숨길지 (피기뱅크는 목표 도달 전까지 비공개가 정석) */
  hidePriceUntilReady?: boolean;
}

export const IAP_PRODUCTS: IapProduct[] = [
  {
    id: 'starter',
    sku: 'city_idle_starter_199',
    title: '스타터 팩',
    desc: '즉시 자금 2시간치 + 전 사업 2배 30분 + 유산 5',
    icon: '🎁',
    priceLabel: '₩2,900',
    oneTime: true,
  },
  {
    id: 'piggy',
    sku: 'city_idle_piggy_299',
    title: '저금통',
    desc: '플레이하는 동안 자금이 쌓입니다. 가득 차면 한 번에 받기',
    icon: '🐷',
    priceLabel: '₩4,400',
    oneTime: false,
    hidePriceUntilReady: true,
  },
  {
    id: 'tabBoost',
    sku: 'city_idle_tabboost_499',
    title: '사업 집중 부스터',
    desc: '선택한 사업 24시간 동안 3배',
    icon: '🚀',
    priceLabel: '₩6,900',
    oneTime: false,
  },
  {
    id: 'adFree',
    sku: 'city_idle_adfree_999',
    title: '광고 제거 + 자동 수집',
    desc: '강제 광고 제거, 오프라인 수익 자동 2배 적용',
    icon: '🚫',
    priceLabel: '₩13,000',
    oneTime: true,
  },
  {
    id: 'redevelop',
    sku: 'city_idle_redev_1999',
    title: '문명 전환 가속 팩',
    desc: '유산 즉시 획득 — 다음 문명을 더 강하게 시작',
    icon: '🏺',
    priceLabel: '₩27,000',
    oneTime: false,
  },
];

/**
 * 저금통은 "포인트"로 찬다 (업그레이드 구매 +1, 광고 +5, 도시 레벨업 +20).
 * 수입이 지수적으로 커져도 진행률 표시가 흔들리지 않게 하려는 것.
 * 보상은 개봉 시점의 초당 수입 기준으로 환산한다.
 */
export const PIGGY_GOAL = 300;

/** 저금통은 도시 레벨 8 이상에서만 노출한다 (기획: 등장 시점이 전부) */
export function piggyVisible(state: GameState): boolean {
  return state.city.level >= 8;
}

export function piggyReady(state: GameState): boolean {
  return piggyVisible(state) && state.shop.piggyValue >= PIGGY_GOAL;
}

export function piggyProgress(state: GameState): number {
  return Math.min(1, state.shop.piggyValue / PIGGY_GOAL);
}

export interface PurchaseProvider {
  readonly name: string;
  purchase(sku: string): Promise<boolean>;
  restore(): Promise<string[]>;
}

/** 개발/웹 빌드용 스텁. 네이티브 빌드에서 실제 결제 플러그인으로 교체한다. */
export class StubPurchaseProvider implements PurchaseProvider {
  readonly name = 'stub';
  constructor(private confirm: (sku: string) => Promise<boolean>) {}
  purchase(sku: string): Promise<boolean> {
    return this.confirm(sku);
  }
  async restore(): Promise<string[]> {
    return [];
  }
}

export function productById(id: IapId): IapProduct {
  return IAP_PRODUCTS.find((p) => p.id === id)!;
}

export interface PurchaseGrant {
  cash?: number;
  blueprint?: number;
  boostSeconds?: number;
  boostBusiness?: BusinessId;
  adFree?: boolean;
}
