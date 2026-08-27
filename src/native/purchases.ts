import type { PurchaseProvider } from '../core/iap';
import { PRODUCT_CATEGORY, Purchases } from '@revenuecat/purchases-capacitor';

/**
 * 네이티브 일회성 인앱결제 어댑터.
 * 권장: RevenueCat (@revenuecat/purchases-capacitor) — 영수증 검증/구독 관리를 대신 해준다.
 *
 *   npm i @revenuecat/purchases-capacitor
 *
 * 주의: 소비성 아이템(스타터팩/저금통)은 반드시 서버 또는 RevenueCat 영수증 검증을 거쳐야 한다.
 */
type PurchasesModule = {
  Purchases: {
    configure(opts: { apiKey: string }): Promise<void>;
    getProducts(opts: { productIdentifiers: string[]; type: PRODUCT_CATEGORY }): Promise<{ products: { identifier: string }[] }>;
    purchaseStoreProduct(opts: { product: { identifier: string } }): Promise<unknown>;
    restorePurchases(): Promise<{ customerInfo: { allPurchasedProductIdentifiers: string[] } }>;
  };
};

export class RevenueCatProvider implements PurchaseProvider {
  readonly name = 'revenuecat';
  private mod: PurchasesModule | null = null;

  /** mod 를 넣으면 그걸 쓴다 (테스트 · SDK 교체용) */
  constructor(
    private apiKey: string,
    mod: PurchasesModule | null = { Purchases },
  ) {
    this.mod = mod;
  }

  async init(): Promise<boolean> {
    try {
      if (!this.mod) return false;
      await this.mod.Purchases.configure({ apiKey: this.apiKey });
      return true;
    } catch (e) {
      console.warn('결제 초기화 실패', e);
      return false;
    }
  }

  async purchase(sku: string): Promise<boolean> {
    if (!this.mod) return false;
    try {
      const { products } = await this.mod.Purchases.getProducts({
        productIdentifiers: [sku],
        type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
      });
      const product = products.find((p) => p.identifier === sku);
      if (!product) return false;
      await this.mod.Purchases.purchaseStoreProduct({ product });
      return true;
    } catch (e) {
      console.warn('결제 실패/취소', e);
      return false;
    }
  }

  async restore(): Promise<string[]> {
    if (!this.mod) return [];
    try {
      const res = await this.mod.Purchases.restorePurchases();
      return res?.customerInfo?.allPurchasedProductIdentifiers ?? [];
    } catch (e) {
      // 복원 실패로 앱이 죽으면 안 된다. 빈 목록이 안전한 답이다
      console.warn('구매 복원 실패', e);
      return [];
    }
  }
}
