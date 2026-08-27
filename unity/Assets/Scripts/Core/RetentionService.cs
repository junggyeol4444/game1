using System;

namespace CityIdle.Core
{
    public sealed class RetentionService
    {
        private static string Day(long nowMs) => DateTimeOffset.FromUnixTimeMilliseconds(nowMs).UtcDateTime.ToString("yyyy-MM-dd");

        public void Refresh(GameState state, long nowMs)
        {
            var day = Day(nowMs);
            if (state.mission.day != day)
            {
                state.mission.day = day;
                state.mission.taps = 0;
                state.mission.buys = 0;
                state.mission.managers = 0;
                state.mission.tapsClaimed = false;
                state.mission.buysClaimed = false;
                state.mission.managersClaimed = false;
                state.mission.targetTaps = 25 + (state.cityLevel / 3) * 5;
                state.mission.targetBuys = 10 + state.cityLevel / 5;
                state.mission.targetManagers = 1;
            }
            if (state.attendance.day != day)
            {
                DateTime previous;
                DateTime current;
                if (DateTime.TryParse(state.attendance.day, out previous) && DateTime.TryParse(day, out current)
                    && (current - previous).TotalDays > 1) state.attendance.streak = 0;
                state.attendance.day = day;
                state.attendance.claimedToday = false;
            }
        }

        public void RecordTap(GameState state, long nowMs)
        {
            Refresh(state, nowMs);
            state.mission.taps = Math.Min(state.mission.targetTaps, state.mission.taps + 1);
        }

        public void RecordBuy(GameState state, long nowMs)
        {
            Refresh(state, nowMs);
            state.mission.buys = Math.Min(state.mission.targetBuys, state.mission.buys + 1);
        }

        public void RecordManager(GameState state, long nowMs)
        {
            Refresh(state, nowMs);
            state.mission.managers = Math.Min(state.mission.targetManagers, state.mission.managers + 1);
        }

        public bool ClaimMission(GameState state, int index, long nowMs)
        {
            Refresh(state, nowMs);
            if (index == 0)
            {
                if (state.mission.tapsClaimed || state.mission.taps < state.mission.targetTaps) return false;
                state.mission.tapsClaimed = true;
            }
            else if (index == 1)
            {
                if (state.mission.buysClaimed || state.mission.buys < state.mission.targetBuys) return false;
                state.mission.buysClaimed = true;
            }
            else if (index == 2)
            {
                if (state.mission.managersClaimed || state.mission.managers < state.mission.targetManagers) return false;
                state.mission.managersClaimed = true;
            }
            else return false;
            state.cash += Math.Max(500, state.cityLevel * 750);
            return true;
        }

        public bool ClaimAttendance(GameState state, long nowMs)
        {
            Refresh(state, nowMs);
            if (state.attendance.claimedToday) return false;
            var rewards = new[] { 500d, 1200, 3000, 7500, 18000, 45000, 120000 };
            state.cash += rewards[state.attendance.streak % rewards.Length] * Math.Max(1, state.era + 1);
            state.attendance.streak = (state.attendance.streak + 1) % rewards.Length;
            state.attendance.claimedToday = true;
            return true;
        }

        public void Discover(GameState state, string key)
        {
            if (!state.collection.discoveries.Contains(key)) state.collection.discoveries.Add(key);
        }

        public void SeeBuilding(GameState state, string key)
        {
            if (!state.collection.seenBuildings.Contains(key)) state.collection.seenBuildings.Add(key);
        }
    }
}
