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
        public event Action Changed;
        private readonly LocalSaveService saves = new LocalSaveService();
        private float autosave;

        private void Awake()
        {
            DontDestroyOnLoad(gameObject);
            State = saves.Load();
            var offline = Economy.ApplyOffline(State, LocalSaveService.UtcNowMs);
            if (offline > 0) Debug.Log($"오프라인 수익 {offline:N0}");
        }

        private void Update()
        {
            Economy.Tick(State, Time.unscaledDeltaTime, LocalSaveService.UtcNowMs);
            autosave += Time.unscaledDeltaTime;
            if (autosave >= 10) { autosave = 0; saves.Save(State); }
            Changed?.Invoke();
        }

        public void Tap(BusinessId id, int unitIndex) { if (Economy.StartManual(State, id, unitIndex)) Changed?.Invoke(); }
        public void Buy(BusinessId id, int unitIndex) { if (Economy.BuyLevel(State, id, unitIndex)) { saves.Save(State); Changed?.Invoke(); } }
        public void Hire(BusinessId id, int unitIndex) { if (Economy.HireManager(State, id, unitIndex)) { saves.Save(State); Changed?.Invoke(); } }
        public void BuyFacility(FacilityId id) { if (Facilities.Buy(State, id)) { saves.Save(State); Changed?.Invoke(); } }
        public void AdvanceEra() { if (Eras.Advance(State, LocalSaveService.UtcNowMs)) { saves.Save(State); Changed?.Invoke(); } }
        private void OnApplicationPause(bool pause) { if (pause) saves.Save(State); }
        private void OnApplicationQuit() => saves.Save(State);
    }
}
