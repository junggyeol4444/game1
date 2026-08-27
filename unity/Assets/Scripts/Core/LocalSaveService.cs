using System;
using UnityEngine;

namespace CityIdle.Core
{
    public sealed class LocalSaveService
    {
        private const string Key = "city-idle-unity-v1";
        private const string BackupKey = Key + "-backup";
        public static long UtcNowMs => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        public GameState Load()
        {
            var loaded = Read(Key) ?? Read(BackupKey);
            return BalanceCatalog.Normalize(loaded, UtcNowMs);
        }

        public void Save(GameState state)
        {
            // 기기 시간을 뒤로 돌려도 기준 시각을 낮추지 않아 같은 구간을 다시 정산하지 않는다.
            state.lastSeenUtcMs = Math.Max(state.lastSeenUtcMs, UtcNowMs);
            var json = JsonUtility.ToJson(state);
            if (PlayerPrefs.HasKey(Key)) PlayerPrefs.SetString(BackupKey, PlayerPrefs.GetString(Key));
            PlayerPrefs.SetString(Key, json);
            PlayerPrefs.Save();
        }

        private static GameState Read(string key)
        {
            if (!PlayerPrefs.HasKey(key)) return null;
            try { return JsonUtility.FromJson<GameState>(PlayerPrefs.GetString(key)); }
            catch (Exception e) { Debug.LogWarning($"세이브 복구 실패: {e.Message}"); return null; }
        }
    }
}
