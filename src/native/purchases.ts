import type { PurchaseProvider } from '../core/iap';

/**
 * 네이티브 인앱결제 어댑터 스텁.
 * 권장: RevenueCat (@revenuecat/purchases-capacitor) — 영수증 검증/구독 관리를 대신 해준다.
 *
 *   npm i @revenuecat/purchases-capacitor
 *
 * 주의: 소비성 아이템(스타터팩/저금통)은 반드시 서버 또는 RevenueCat 영수증 검증을 거쳐야 한다.
 */
type PurchasesModule = {
  Purchases: {
    configure(opts: { apiKey: string }): Promise<void>;
    getOfferings(): Promise<unknown>;
    purchaseStoreProduct(opts: unknown): Promise<unknown>;
    restorePurchases(): Promise<{ customerInfo: { allPurchasedProductIdentifiers: string[] } }>;
  };
};

export class RevenueCatProvider implements PurchaseProvider {
  readonly name = 'revenuecat';
  private mod: PurchasesModule | null = null;

  constructor(private apiKey: string) {}

  async init(): Promise<boolean> {
    try {
      const spec = '@revenuecat/purchases-capacitor';
      this.mod = (await import(/* @vite-ignore */ spec)) as unknown as PurchasesModule;
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
      await this.mod.Purchases.purchaseStoreProduct({ product: { identifier: sku } });
      return true;
    } catch (e) {
      console.warn('결제 실패/취소', e);
      return false;
    }
  }

  async restore(): Promise<string[]> {
    if (!this.mod) return [];
    const res = await this.mod.Purchases.restorePurchases();
    return res.customerInfo.allPurchasedProductIdentifiers ?? [];
  }
}
