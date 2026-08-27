using System;

namespace CityIdle.Core
{
    public sealed class EconomyService
    {
        private readonly FacilityService facilities = new FacilityService();
        public double UnitCost(BusinessDef business, UnitState unit, int unitIndex, int count = 1)
        {
            var def = BalanceCatalog.Unit(business, unitIndex);
            var first = def.BaseCost * Math.Pow(def.Growth, unit.level);
            return first * (Math.Pow(def.Growth, count) - 1) / (def.Growth - 1);
        }

        public double RatePerSecond(GameState state, BusinessDef def, double nowMs)
        {
            if (state.cityLevel < def.UnlockLevel) return 0;
            var business = state.businesses[(int)def.Id];
            double total = 0;
            for (var i = 0; i < business.units.Count; i++)
            {
                var unit = business.units[i];
                if (!unit.unlocked || unit.level <= 0 || !unit.manager) continue;
                var row = BalanceCatalog.Unit(def, i);
                total += Output(unit.level, row.Output) / Cycle(unit.level, row.Cycle);
            }
            return total * HoistMultiplier(business.hoistLevel) * Boost(business, nowMs)
                * facilities.OperationEfficiency(state) * facilities.OutputMultiplier(state);
        }

        public void Tick(GameState state, double deltaSeconds, double nowMs)
        {
            deltaSeconds = Math.Max(0, Math.Min(deltaSeconds, .25));
            facilities.Tick(state, deltaSeconds);
            foreach (var def in BalanceCatalog.Businesses)
            {
                if (state.cityLevel < def.UnlockLevel) continue;
                var business = state.businesses[(int)def.Id];
                for (var i = 0; i < business.units.Count; i++)
                {
                    var unit = business.units[i];
                    if (!unit.unlocked || unit.level <= 0 || (!unit.manager && !unit.running)) continue;
                    var row = BalanceCatalog.Unit(def, i);
                    unit.progress += deltaSeconds;
                    var cycle = Cycle(unit.level, row.Cycle);
                    if (unit.progress < cycle) continue;
                    var completed = Math.Floor(unit.progress / cycle);
                    unit.progress %= cycle;
                    var amount = Output(unit.level, row.Output) * completed * HoistMultiplier(business.hoistLevel)
                        * Boost(business, nowMs) * facilities.OperationEfficiency(state) * facilities.OutputMultiplier(state);
                    Produce(state, def, amount);
                    if (!unit.manager) unit.running = false;
                }
            }
            while (state.taxRun >= CityRequirement(state.cityLevel + 1)) state.cityLevel++;
        }

        public bool BuyLevel(GameState state, BusinessId id, int unitIndex)
        {
            var def = BalanceCatalog.Businesses[(int)id];
            if (state.cityLevel < def.UnlockLevel || unitIndex < 0 || unitIndex >= 12) return false;
            var unit = state.businesses[(int)id].units[unitIndex];
            var row = BalanceCatalog.Unit(def, unitIndex);
            if (!unit.unlocked && unitIndex > 0 && !state.businesses[(int)id].units[unitIndex - 1].unlocked) return false;
            var cost = unit.unlocked ? row.BaseCost * Math.Pow(row.Growth, unit.level) : row.UnlockCost;
            if (state.cash < cost) return false;
            state.cash -= cost;
            unit.level++;
            unit.unlocked = true;
            return true;
        }

        public bool StartManual(GameState state, BusinessId id, int unitIndex)
        {
            var def = BalanceCatalog.Businesses[(int)id];
            if (state.cityLevel < def.UnlockLevel || unitIndex < 0 || unitIndex >= 12) return false;
            var unit = state.businesses[(int)id].units[unitIndex];
            if (!unit.unlocked || unit.level <= 0 || unit.running || unit.manager) return false;
            unit.running = true;
            unit.progress = 0;
            return true;
        }

        public bool HireManager(GameState state, BusinessId id, int unitIndex)
        {
            var def = BalanceCatalog.Businesses[(int)id];
            var unit = state.businesses[(int)id].units[unitIndex];
            var row = BalanceCatalog.Unit(def, unitIndex);
            if (!unit.unlocked || unit.level <= 0 || unit.manager || state.cash < row.ManagerCost) return false;
            state.cash -= row.ManagerCost;
            unit.manager = true;
            return true;
        }

        public double ApplyOffline(GameState state, long nowMs)
        {
            var elapsed = Math.Max(0, (nowMs - state.lastSeenUtcMs) / 1000d);
            var capped = Math.Min(elapsed, 2 * 3600);
            double cash = 0;
            foreach (var def in BalanceCatalog.Businesses) cash += RatePerSecond(state, def, nowMs) * capped * .5;
            state.cash += cash;
            var tax = cash * .1 * facilities.TaxMultiplier(state);
            state.taxRun += tax;
            state.taxTotal += tax;
            state.lastSeenUtcMs = nowMs;
            return cash;
        }

        private static double Output(int level, double baseOutput)
        {
            var multiplier = 1d;
            foreach (var mark in BalanceCatalog.Milestones) if (level >= mark) multiplier *= 2;
            return baseOutput * level * multiplier;
        }

        private static double Cycle(int level, double baseCycle)
        {
            foreach (var mark in BalanceCatalog.HalfCycles) if (level >= mark) baseCycle *= .5;
            return Math.Max(.05, baseCycle);
        }

        private static double HoistMultiplier(int level) => 1 + Math.Max(0, level - 1) * 2;
        private static double Boost(BusinessState state, double nowMs = 0) => state.boostUntil > nowMs ? 2 : 1;

        private void Produce(GameState state, BusinessDef def, double amount)
        {
            var efficiency = ChainEfficiency(state, def, amount);
            amount *= efficiency;
            switch (def.Id)
            {
                case BusinessId.Mine: state.ore += amount; break;
                case BusinessId.Factory: state.goods += amount; break;
                case BusinessId.Fishery: state.food += amount; break;
                case BusinessId.Park: state.visitors += amount; break;
            }
            var cash = amount;
            state.cash += cash;
            state.material += amount * .25;
            var tax = cash * .1 * facilities.TaxMultiplier(state);
            state.taxRun += tax;
            state.taxTotal += tax;
        }

        private static double ChainEfficiency(GameState state, BusinessDef def, double requested)
        {
            if (!def.Input.HasValue || state.cityLevel < 12) return 1;
            var need = requested * def.InputRatio / Math.Max(1, def.OutputScale);
            var available = Resource(state, def.Input.Value);
            var efficiency = Math.Max(.25, Math.Min(1, available / Math.Max(need, double.Epsilon)));
            Consume(state, def.Input.Value, need * efficiency);
            return efficiency;
        }

        private static double Resource(GameState state, BusinessId id)
        {
            switch (id)
            {
                case BusinessId.Mine: return state.ore;
                case BusinessId.Factory: return state.goods;
                case BusinessId.Fishery: return state.food;
                case BusinessId.Park: return state.visitors;
                default: return state.cash;
            }
        }

        private static void Consume(GameState state, BusinessId id, double amount)
        {
            switch (id)
            {
                case BusinessId.Mine: state.ore = Math.Max(0, state.ore - amount); break;
                case BusinessId.Factory: state.goods = Math.Max(0, state.goods - amount); break;
                case BusinessId.Fishery: state.food = Math.Max(0, state.food - amount); break;
                case BusinessId.Park: state.visitors = Math.Max(0, state.visitors - amount); break;
            }
        }

        private static double CityRequirement(int level) => level <= 1 ? 0 : 50 * Math.Pow(8, level - 2);

    }
}
