using System;

namespace CityIdle.Core
{
    public sealed class FacilityService
    {
        public double Cost(GameState state, FacilityId id)
        {
            var def = BalanceCatalog.Facilities[(int)id];
            var level = state.facilities[(int)id].level;
            return level >= def.MaxLevel ? double.PositiveInfinity : def.BaseCost * Math.Pow(def.Growth, level);
        }

        public bool Buy(GameState state, FacilityId id)
        {
            var def = BalanceCatalog.Facilities[(int)id];
            if (state.cityLevel < def.UnlockLevel) return false;
            var cost = Cost(state, id);
            if (double.IsInfinity(cost) || double.IsNaN(cost) || state.cash < cost) return false;
            state.cash -= cost;
            state.facilities[(int)id].level++;
            return true;
        }

        public double PopulationCapacity(GameState state) => 50 + Level(state, FacilityId.Housing) * 75;
        public double PowerSupply(GameState state) => 60 + Level(state, FacilityId.Power) * 100;
        public double PopulationDemand(GameState state)
        {
            double demand = 0;
            foreach (var business in state.businesses)
                foreach (var unit in business.units) if (unit.unlocked) demand += Math.Max(1, unit.level) * 10;
            return demand;
        }
        public double PowerDemand(GameState state)
        {
            double demand = 0;
            foreach (var business in state.businesses)
                foreach (var unit in business.units) if (unit.unlocked) demand += Math.Max(1, unit.level) * 5;
            return demand;
        }
        public double OperationEfficiency(GameState state)
        {
            var labor = Math.Min(1, state.population / Math.Max(1, PopulationDemand(state)));
            var power = Math.Max(.15, Math.Min(1, PowerSupply(state) / Math.Max(1, PowerDemand(state))));
            return labor * power;
        }
        public double TaxMultiplier(GameState state) => 1 + Level(state, FacilityId.Shops) * .08;
        public double OutputMultiplier(GameState state) => 1 + Level(state, FacilityId.School) * .06;
        public double PopulationGrowth(GameState state) => .6 * (1 + Level(state, FacilityId.Green) * .1);

        public void Tick(GameState state, double deltaSeconds)
        {
            state.population = Math.Min(PopulationCapacity(state), state.population + PopulationGrowth(state) * deltaSeconds);
        }

        private static int Level(GameState state, FacilityId id) => state.facilities[(int)id].level;
    }
}
