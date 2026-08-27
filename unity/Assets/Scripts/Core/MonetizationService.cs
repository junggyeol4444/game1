using System;
using System.Threading.Tasks;

namespace CityIdle.Core
{
    public enum RewardedPlacement { OfflineDouble, BusinessBoost, CashDrop, EraBonus, Minigame }

    public interface IMonetizationService
    {
        bool IsRewardedReady(RewardedPlacement placement);
        Task<bool> ShowRewarded(RewardedPlacement placement);
        Task<bool> Purchase(string storeProductId);
        Task RestorePermanentPurchases(Action<string> restored);
    }

    /// <summary>에디터 플레이용. 실제 빌드에는 포함되지 않아 결제 우회가 불가능하다.</summary>
#if UNITY_EDITOR
    public sealed class EditorMonetizationService : IMonetizationService
    {
        public bool IsRewardedReady(RewardedPlacement placement) => true;
        public Task<bool> ShowRewarded(RewardedPlacement placement) => Task.FromResult(true);
        public Task<bool> Purchase(string storeProductId) => Task.FromResult(true);
        public Task RestorePermanentPurchases(Action<string> restored) => Task.CompletedTask;
    }
#endif

    /// <summary>SDK가 설정되지 않은 빌드는 보상과 상품을 절대 지급하지 않는다.</summary>
    public sealed class DisabledMonetizationService : IMonetizationService
    {
        public bool IsRewardedReady(RewardedPlacement placement) => false;
        public Task<bool> ShowRewarded(RewardedPlacement placement) => Task.FromResult(false);
        public Task<bool> Purchase(string storeProductId) => Task.FromResult(false);
        public Task RestorePermanentPurchases(Action<string> restored) => Task.CompletedTask;
    }
}
