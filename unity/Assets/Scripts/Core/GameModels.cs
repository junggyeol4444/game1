using System;
using System.Collections.Generic;
using UnityEngine;

namespace CityIdle.Core
{
    public enum BusinessId { Mine, Factory, Fishery, Park, Corp }
    public enum FacilityId { Housing, Shops, Road, Power, School, Hospital, Green, Fire, Police }

    [Serializable]
    public sealed class UnitState
    {
        public bool unlocked;
        public int level;
        public bool equipped;
        public bool manager;
        public bool running;
        public double progress;
    }

    [Serializable]
    public sealed class BusinessState
    {
        public BusinessId id;
        public int hoistLevel = 1;
        public double boostUntil;
        public List<UnitState> units = new List<UnitState>();
    }

    [Serializable]
    public sealed class FacilityState
    {
        public FacilityId id;
        public int level;
    }

    [Serializable]
    public sealed class GameState
    {
        public int version = 1;
        public long lastSeenUtcMs;
        public int era;
        public int cityLevel = 1;
        public double cash = 20;
        public double material;
        public double ore;
        public double goods;
        public double food;
        public double visitors;
        public int gems;
        public int legacy;
        public double taxRun;
        public double taxTotal;
        public double population = 50;
        public int eraRepeat;
        public List<BusinessState> businesses = new List<BusinessState>();
        public List<FacilityState> facilities = new List<FacilityState>();
    }

    public readonly struct UnitDef
    {
        public readonly double UnlockCost, BaseCost, Growth, Output, Cycle, ManagerCost;
        public UnitDef(double unlock, double cost, double growth, double output, double cycle, double manager)
        {
            UnlockCost = unlock; BaseCost = cost; Growth = growth;
            Output = output; Cycle = cycle; ManagerCost = manager;
        }
    }

    public readonly struct BusinessDef
    {
        public readonly BusinessId Id;
        public readonly string Name;
        public readonly int UnlockLevel;
        public readonly double CostScale, OutputScale, CycleScale;
        public readonly BusinessId? Input;
        public readonly double InputRatio;
        public BusinessDef(BusinessId id, string name, int unlock, double cost, double output, double cycle,
            BusinessId? input = null, double inputRatio = 0)
        {
            Id = id; Name = name; UnlockLevel = unlock;
            CostScale = cost; OutputScale = output; CycleScale = cycle;
            Input = input; InputRatio = inputRatio;
        }
    }

    public readonly struct FacilityDef
    {
        public readonly FacilityId Id;
        public readonly string Name;
        public readonly int UnlockLevel, MaxLevel;
        public readonly double BaseCost, Growth;
        public FacilityDef(FacilityId id, string name, int unlock, int max, double cost, double growth)
        {
            Id = id; Name = name; UnlockLevel = unlock; MaxLevel = max; BaseCost = cost; Growth = growth;
        }
    }

    public static class BalanceCatalog
    {
        public static readonly int[] Milestones = { 10, 25, 50, 100, 200, 400, 800, 1600 };
        public static readonly int[] HalfCycles = { 25, 100, 400, 1600 };
        public static readonly BusinessDef[] Businesses =
        {
            new BusinessDef(BusinessId.Mine, "광산", 1, 1, 1, 1),
            new BusinessDef(BusinessId.Factory, "공장", 3, 1250, 800, 2 / 0.6, BusinessId.Mine, 1.1),
            new BusinessDef(BusinessId.Fishery, "어항", 6, 600000, 350000, 4 / 0.6),
            new BusinessDef(BusinessId.Park, "놀이공원", 10, 300000000, 160000000, 8 / 0.6, BusinessId.Fishery, 1.8),
            new BusinessDef(BusinessId.Corp, "기업", 15, 1.5e14, 8e13, 16 / 0.6, BusinessId.Factory, 40)
        };
        public static readonly FacilityDef[] Facilities =
        {
            new FacilityDef(FacilityId.Housing, "주거지", 2, 40, 150, 1.75),
            new FacilityDef(FacilityId.Shops, "상가", 3, 40, 500, 1.8),
            new FacilityDef(FacilityId.Road, "도로", 4, 30, 1800, 1.85),
            new FacilityDef(FacilityId.Power, "발전소", 5, 40, 6000, 1.9),
            new FacilityDef(FacilityId.School, "학교", 7, 30, 25000, 2),
            new FacilityDef(FacilityId.Hospital, "병원", 8, 30, 90000, 2.05),
            new FacilityDef(FacilityId.Green, "공원", 9, 30, 350000, 2.1),
            new FacilityDef(FacilityId.Fire, "소방서", 11, 20, 1500000, 2.2),
            new FacilityDef(FacilityId.Police, "경찰서", 13, 20, 6000000, 2.25)
        };
        public static readonly string[] EraNames =
        {
            "석기 시대", "청동기 시대", "철기 시대", "중세", "르네상스",
            "산업 시대", "현대", "정보 시대", "우주 시대"
        };
        public static readonly int[] EraAdvanceLevels = { 7, 9, 11, 13, 15, 17, 19, 21, 23 };

        // 기존 프로토타입의 12층 사다리와 같은 성장 형태. 밸런스 확정 전 ScriptableObject로 분리한다.
        private static readonly double[] Unlock = { 0, 60, 720, 8640, 103680, 1244160, 14929920, 179159040, 2149908480, 2.58e10, 3.10e11, 3.72e12 };
        private static readonly double[] Cycles = { .6, 1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 900 };

        public static UnitDef Unit(BusinessDef business, int index)
        {
            var tier = index + 1;
            var unlock = Unlock[index] * business.CostScale;
            var cost = Math.Max(4, Math.Pow(12, index)) * business.CostScale;
            var output = Math.Pow(10, index) * business.OutputScale;
            return new UnitDef(unlock, cost, 1.07 + index * .004, output,
                Cycles[index] * business.CycleScale, cost * 25);
        }

        public static GameState NewGame(long nowMs)
        {
            var state = new GameState { lastSeenUtcMs = nowMs };
            foreach (var def in Businesses)
            {
                var business = new BusinessState { id = def.Id };
                for (var i = 0; i < 12; i++) business.units.Add(new UnitState());
                state.businesses.Add(business);
            }
            foreach (var def in Facilities) state.facilities.Add(new FacilityState { id = def.Id });
            state.businesses[0].units[0].unlocked = true;
            state.businesses[0].units[0].level = 1;
            return state;
        }

        public static GameState Normalize(GameState state, long nowMs)
        {
            if (state == null) return NewGame(nowMs);
            state.businesses = state.businesses ?? new List<BusinessState>();
            while (state.businesses.Count < Businesses.Length)
                state.businesses.Add(new BusinessState { id = (BusinessId)state.businesses.Count });
            for (var i = 0; i < state.businesses.Count; i++)
            {
                state.businesses[i].units = state.businesses[i].units ?? new List<UnitState>();
                while (state.businesses[i].units.Count < 12) state.businesses[i].units.Add(new UnitState());
            }
            state.facilities = state.facilities ?? new List<FacilityState>();
            while (state.facilities.Count < Facilities.Length)
                state.facilities.Add(new FacilityState { id = (FacilityId)state.facilities.Count });
            if (state.population <= 0) state.population = 50;
            if (state.lastSeenUtcMs <= 0) state.lastSeenUtcMs = nowMs;
            return state;
        }
    }
}
