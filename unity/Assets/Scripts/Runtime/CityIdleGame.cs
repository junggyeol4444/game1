using System;
using CityIdle.Core;
using UnityEngine;

namespace CityIdle.Runtime
{
    public sealed class CityIdleGame : MonoBehaviour
    {
        public GameState State { get; private set; }
        public EconomyService Economy { get; } = new EconomyService();
        public FacilityService Facilities { get; } = new FacilityService();
        public EraService Eras { get; } = new EraService();
        public RetentionService Retention { get; } = new RetentionService();
        public MinigameService Minigames { get; } = new MinigameService();
        public MinigameSession ActiveMinigame { get; private set; }
        public MinigameResult LastMinigameResult { get; private set; }
        public MonetizationController Monetization { get; private set; }
        public event Action Changed;
        private readonly LocalSaveService saves = new LocalSaveService();
        private float autosave;

        private void Awake()
        {
            DontDestroyOnLoad(gameObject);
            State = saves.Load();
            Monetization = new MonetizationController(CreateDefaultMonetization());
            Retention.Refresh(State, LocalSaveService.UtcNowMs);
            var offline = Economy.ApplyOffline(State, LocalSaveService.UtcNowMs);
            if (offline > 0) Debug.Log($"오프라인 수익 {offline:N0}");
        }

        private void Update()
        {
            Economy.Tick(State, Time.unscaledDeltaTime, LocalSaveService.UtcNowMs);
            var result = Minigames.Tick(State, ActiveMinigame, Time.unscaledDeltaTime, Retention);
            if (result != null) { LastMinigameResult = result; saves.Save(State); }
            autosave += Time.unscaledDeltaTime;
            if (autosave >= 10) { autosave = 0; saves.Save(State); }
            Changed?.Invoke();
        }

        public void Tap(BusinessId id, int unitIndex)
        {
            if (!Economy.StartManual(State, id, unitIndex)) return;
            Retention.RecordTap(State, LocalSaveService.UtcNowMs); Changed?.Invoke();
        }
        public void Buy(BusinessId id, int unitIndex)
        {
            if (!Economy.BuyLevel(State, id, unitIndex)) return;
            Retention.RecordBuy(State, LocalSaveService.UtcNowMs);
            Retention.SeeBuilding(State, $"{State.era}:business:{id}:{unitIndex}");
            saves.Save(State); Changed?.Invoke();
        }
        public void Hire(BusinessId id, int unitIndex)
        {
            if (!Economy.HireManager(State, id, unitIndex)) return;
            Retention.RecordManager(State, LocalSaveService.UtcNowMs); saves.Save(State); Changed?.Invoke();
        }
        public void BuyFacility(FacilityId id)
        {
            if (!Facilities.Buy(State, id)) return;
            Retention.RecordBuy(State, LocalSaveService.UtcNowMs);
            Retention.SeeBuilding(State, $"{State.era}:facility:{id}:{State.facilities[(int)id].level}");
            saves.Save(State); Changed?.Invoke();
        }
        public void AdvanceEra() { if (Eras.Advance(State, LocalSaveService.UtcNowMs)) { saves.Save(State); Changed?.Invoke(); } }
        public void ClaimMission(int index) { if (Retention.ClaimMission(State, index, LocalSaveService.UtcNowMs)) { saves.Save(State); Changed?.Invoke(); } }
        public void ClaimAttendance() { if (Retention.ClaimAttendance(State, LocalSaveService.UtcNowMs)) { saves.Save(State); Changed?.Invoke(); } }
        public void StartMinigame(BusinessId id)
        {
            ActiveMinigame = Minigames.Start(State, id, LocalSaveService.UtcNowMs, false);
            LastMinigameResult = null; saves.Save(State); Changed?.Invoke();
        }
        public async void StartRewardedMinigame(BusinessId id)
        {
            if (!Minigames.HasRewardedPlay(State, LocalSaveService.UtcNowMs)) return;
            await Monetization.Reward(State, RewardedPlacement.Minigame, () =>
            {
                ActiveMinigame = Minigames.Start(State, id, LocalSaveService.UtcNowMs, true);
                LastMinigameResult = null;
            });
            saves.Save(State); Changed?.Invoke();
        }
        public async void Purchase(string productId)
        {
            if (await Monetization.Purchase(State, productId)) saves.Save(State);
            Changed?.Invoke();
        }
        public async void RestorePurchases() { await Monetization.Restore(State); saves.Save(State); Changed?.Invoke(); }
        public void SetMonetizationService(IMonetizationService service) => Monetization.SetService(service);
        public void TapMinigame()
        {
            if (ActiveMinigame == null) return;
            Minigames.Tap(ActiveMinigame, Mathf.PingPong(Time.unscaledTime * 1.7f, 1)); Changed?.Invoke();
        }
        private void OnApplicationPause(bool pause) { if (pause) saves.Save(State); }
        private void OnApplicationQuit() => saves.Save(State);

        private static IMonetizationService CreateDefaultMonetization()
        {
#if UNITY_EDITOR
            return new EditorMonetizationService();
#else
            return new DisabledMonetizationService();
#endif
        }
    }
}
