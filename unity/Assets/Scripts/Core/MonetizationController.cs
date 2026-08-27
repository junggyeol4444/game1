using System;
using System.Threading.Tasks;

namespace CityIdle.Core
{
    public static class StoreProducts
    {
        public const string StarterPack = "city_idle_starter_pack";
        public const string PiggyBank = "city_idle_piggy_bank";
        public const string BusinessBoost = "city_idle_business_boost";
        public const string RemoveAds = "city_idle_remove_ads";
        public const string EraAccelerator = "city_idle_era_accelerator";

        public static bool IsKnown(string id) => id == StarterPack || id == PiggyBank || id == BusinessBoost
            || id == RemoveAds || id == EraAccelerator;
        public static bool IsOneTime(string id) => id == StarterPack || id == RemoveAds || id == EraAccelerator;
        public static bool IsRestorable(string id) => IsOneTime(id);
    }

    /// <summary>SDK 성공 응답을 확인한 뒤에만 로컬 상품과 광고 보상을 지급한다.</summary>
    public sealed class MonetizationController
    {
        private IMonetizationService service;
        private bool busy;

        public MonetizationController(IMonetizationService service) => this.service = service ?? new DisabledMonetizationService();
        public bool Busy => busy;
        public void SetService(IMonetizationService next) => service = next ?? new DisabledMonetizationService();

        public async Task<bool> Reward(GameState state, RewardedPlacement placement, Action grant)
        {
            if (busy || (!state.purchases.adsRemoved && !service.IsRewardedReady(placement))) return false;
            busy = true;
            try
            {
                var completed = state.purchases.adsRemoved || await service.ShowRewarded(placement);
                if (!completed) return false;
                grant?.Invoke();
                return true;
            }
            catch { return false; }
            finally { busy = false; }
        }

        public async Task<bool> Purchase(GameState state, string productId)
        {
            if (busy || !StoreProducts.IsKnown(productId)) return false;
            if (StoreProducts.IsOneTime(productId) && state.purchases.ownedProducts.Contains(productId)) return false;
            busy = true;
            try
            {
                if (!await service.Purchase(productId)) return false;
                ApplyProduct(state, productId);
                return true;
            }
            catch { return false; }
            finally { busy = false; }
        }

        public async Task Restore(GameState state)
        {
            if (busy) return;
            busy = true;
            try { await service.RestorePermanentPurchases(id => { if (StoreProducts.IsRestorable(id)) ApplyProduct(state, id); }); }
            catch { /* 네트워크·스토어 실패는 보상 없이 다음 실행에서 다시 시도한다. */ }
            finally { busy = false; }
        }

        private static void ApplyProduct(GameState state, string id)
        {
            if (StoreProducts.IsOneTime(id))
            {
                if (state.purchases.ownedProducts.Contains(id)) return;
                state.purchases.ownedProducts.Add(id);
            }
            if (id == StoreProducts.RemoveAds) state.purchases.adsRemoved = true;
            else if (id == StoreProducts.StarterPack) { state.cash += 25000; state.gems += 50; }
            else if (id == StoreProducts.PiggyBank) state.gems += 120;
            else if (id == StoreProducts.BusinessBoost) state.cash += Math.Max(1000, state.cash * .25);
            else if (id == StoreProducts.EraAccelerator) state.legacy += 25;
        }
    }
}
