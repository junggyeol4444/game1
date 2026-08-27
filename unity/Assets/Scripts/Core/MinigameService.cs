using System;

namespace CityIdle.Core
{
    public enum MinigameKind { MiningTiming, FactorySorting, Fishing, ParkRhythm, CorporateDeal }

    public sealed class MinigameSession
    {
        public BusinessId business;
        public MinigameKind kind;
        public double remaining;
        public int score;
        public int combo;
        public bool completed;
    }

    public sealed class MinigameResult
    {
        public int score;
        public double successRate;
        public double cashReward;
        public string discovery;
    }

    public sealed class MinigameService
    {
        public const int DailyFreeLimit = 3;
        public const int DailyRewardedLimit = 5;
        private static readonly string[][] Discoveries =
        {
            new[] { "석영", "자수정", "루비" },
            new[] { "정밀 부품", "로봇 팔", "양자 칩" },
            new[] { "고등어", "참치", "황금 물고기" },
            new[] { "회전목마", "롤러코스터", "우주 관람차" },
            new[] { "지역 계약", "글로벌 계약", "화성 개발권" }
        };

        public void RefreshDaily(GameState state, long nowMs)
        {
            var day = DateTimeOffset.FromUnixTimeMilliseconds(nowMs).UtcDateTime.ToString("yyyy-MM-dd");
            if (state.dailyPlay.day == day) return;
            state.dailyPlay.day = day;
            state.dailyPlay.freeMinigames = 0;
            state.dailyPlay.rewardedMinigames = 0;
        }

        public bool HasFreePlay(GameState state, long nowMs)
        {
            RefreshDaily(state, nowMs);
            return state.dailyPlay.freeMinigames < DailyFreeLimit;
        }

        public bool HasRewardedPlay(GameState state, long nowMs)
        {
            RefreshDaily(state, nowMs);
            return state.dailyPlay.rewardedMinigames < DailyRewardedLimit;
        }

        public MinigameSession Start(GameState state, BusinessId business, long nowMs, bool rewarded)
        {
            RefreshDaily(state, nowMs);
            if (rewarded)
            {
                if (!HasRewardedPlay(state, nowMs)) return null;
                state.dailyPlay.rewardedMinigames++;
            }
            else
            {
                if (!HasFreePlay(state, nowMs)) return null;
                state.dailyPlay.freeMinigames++;
            }
            return new MinigameSession { business = business, kind = (MinigameKind)business, remaining = 30 };
        }

        public bool Tap(MinigameSession session, double normalizedTiming)
        {
            if (session == null || session.completed || session.remaining <= 0) return false;
            double accuracy;
            switch (session.kind)
            {
                case MinigameKind.MiningTiming: // 중앙 광맥을 정타
                    accuracy = 1 - Math.Min(1, Math.Abs(normalizedTiming - .5) * 2);
                    break;
                case MinigameKind.FactorySorting: // 3개 컨베이어 칸의 중앙을 맞춤
                    accuracy = 1 - Math.Min(1, Math.Abs(normalizedTiming * 3 % 1 - .5) * 2);
                    break;
                case MinigameKind.Fishing: // 좌우로 흔들리는 찌를 좁은 구간에서 낚음
                    accuracy = 1 - Math.Min(1, Math.Abs(normalizedTiming - .62) * 2.6);
                    break;
                case MinigameKind.ParkRhythm: // 박자 양끝을 반복해서 맞춤
                    accuracy = Math.Abs(normalizedTiming - .5) * 2;
                    break;
                default: // 기업 협상: 너무 안전하거나 무리하지 않는 70% 지점
                    accuracy = 1 - Math.Min(1, Math.Abs(normalizedTiming - .7) * 2.2);
                    break;
            }
            var threshold = .58;
            if (accuracy >= threshold)
            {
                session.combo++;
                session.score += 10 + Math.Min(20, session.combo);
                return true;
            }
            session.combo = 0;
            session.score += 2;
            return false;
        }

        public MinigameResult Tick(GameState state, MinigameSession session, double deltaSeconds, RetentionService retention)
        {
            if (session == null || session.completed) return null;
            session.remaining = Math.Max(0, session.remaining - Math.Max(0, deltaSeconds));
            if (session.remaining > 0) return null;
            session.completed = true;
            var rate = Math.Min(1, session.score / 500d);
            var reward = Math.Max(200, state.cityLevel * 1000 * (.5 + rate * 2.5));
            state.cash += reward;
            var tier = Math.Min(2, (int)Math.Floor(rate * 3));
            var discovery = Discoveries[(int)session.business][tier];
            retention.Discover(state, discovery);
            return new MinigameResult { score = session.score, successRate = rate, cashReward = reward, discovery = discovery };
        }
    }
}
