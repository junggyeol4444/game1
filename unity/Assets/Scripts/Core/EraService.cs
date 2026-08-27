using System;

namespace CityIdle.Core
{
    public sealed class EraService
    {
        public string CurrentName(GameState state) => BalanceCatalog.EraNames[Math.Min(state.era, BalanceCatalog.EraNames.Length - 1)];
        public int RequiredCityLevel(GameState state)
        {
            var index = Math.Min(state.era, BalanceCatalog.EraAdvanceLevels.Length - 1);
            return BalanceCatalog.EraAdvanceLevels[index] + (state.eraRepeat * 2);
        }
        public bool CanAdvance(GameState state) => state.cityLevel >= RequiredCityLevel(state);
        public int LegacyGain(GameState state)
        {
            if (!CanAdvance(state)) return 0;
            var over = Math.Max(0, state.cityLevel - RequiredCityLevel(state));
            return Math.Max(1, (int)Math.Floor(12 * Math.Pow(2, state.era) * Math.Sqrt(1 + over)));
        }

        public bool Advance(GameState state, long nowMs)
        {
            var gain = LegacyGain(state);
            if (gain <= 0) return false;
            var nextEra = state.era;
            var repeat = state.eraRepeat;
            if (state.era < BalanceCatalog.EraNames.Length - 1) nextEra++;
            else repeat++;
            var fresh = BalanceCatalog.NewGame(nowMs);
            fresh.era = nextEra;
            fresh.eraRepeat = repeat;
            fresh.legacy = state.legacy + gain;
            Copy(fresh, state);
            return true;
        }

        private static void Copy(GameState source, GameState target)
        {
            target.version = source.version; target.lastSeenUtcMs = source.lastSeenUtcMs;
            target.era = source.era; target.eraRepeat = source.eraRepeat; target.cityLevel = source.cityLevel;
            target.cash = source.cash; target.material = source.material; target.ore = source.ore;
            target.goods = source.goods; target.food = source.food; target.visitors = source.visitors;
            target.gems = source.gems; target.legacy = source.legacy; target.taxRun = source.taxRun;
            target.taxTotal = source.taxTotal; target.population = source.population;
            target.businesses = source.businesses; target.facilities = source.facilities;
        }
    }
}
