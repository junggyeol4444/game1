using CityIdle.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CityIdle.Runtime
{
    public static class RuntimeBootstrap
    {
        private static Font uiFont;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Build()
        {
            if (Object.FindObjectOfType<CityIdleGame>()) return;
            var game = new GameObject("CityIdleGame").AddComponent<CityIdleGame>();
            if (!Object.FindObjectOfType<EventSystem>())
            {
                var events = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
                Object.DontDestroyOnLoad(events);
            }
            BuildCamera();
            BuildCity(game);
            BuildUi(game);
        }

        private static void BuildCamera()
        {
            var existing = Object.FindObjectOfType<Camera>();
            var go = existing ? existing.gameObject : new GameObject("Main Camera", typeof(Camera));
            go.tag = "MainCamera";
            go.transform.position = new Vector3(0, 0, -10);
            var camera = go.GetComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 6;
            camera.backgroundColor = new Color32(191, 217, 168, 255);
            if (!go.GetComponent<AliveCityView>()) go.AddComponent<AliveCityView>();
        }

        private static void BuildCity(CityIdleGame game)
        {
            var root = new GameObject("Living City");
            for (var y = 0; y < 3; y++)
            for (var x = 0; x < 5; x++)
            {
                var lot = GameObject.CreatePrimitive(PrimitiveType.Quad);
                lot.name = $"Lot {x}-{y}";
                lot.transform.SetParent(root.transform);
                lot.transform.position = new Vector3((x - 2) * 1.8f, (y - 1) * 1.6f, y * .01f);
                lot.transform.localScale = new Vector3(1.45f, 1.15f, 1);
                lot.GetComponent<Renderer>().material.color = new Color(.35f + x * .05f, .55f + y * .05f, .38f);
            }
            for (var i = 0; i < 24; i++) CreateCitizen(root.transform, i);
        }

        private static void CreateCitizen(Transform parent, int index)
        {
            var citizen = GameObject.CreatePrimitive(PrimitiveType.Quad);
            citizen.name = $"Citizen {index:00}";
            citizen.transform.SetParent(parent);
            citizen.transform.localScale = Vector3.one * .18f;
            citizen.GetComponent<Renderer>().material.color = Color.HSVToRGB((index * .13f) % 1, .55f, .95f);
            var mover = citizen.AddComponent<CitizenMover>();
            mover.phase = index * .71f;
            mover.lane = index % 5 - 2;
        }

        private static void BuildUi(CityIdleGame game)
        {
            var canvasGo = new GameObject("Mobile UI", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            uiFont = Font.CreateDynamicFontFromOSFont(
                new[] { "Noto Sans CJK KR", "Malgun Gothic", "Apple SD Gothic Neo", "Arial Unicode MS", "Arial" }, 32);
            if (!uiFont) uiFont = Resources.GetBuiltinResource<Font>("Arial.ttf");
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = .5f;

            var cash = Label(canvas.transform, "Cash", 42, TextAnchor.MiddleCenter);
            cash.rectTransform.anchorMin = new Vector2(.05f, .92f);
            cash.rectTransform.anchorMax = new Vector2(.95f, .99f);
            cash.rectTransform.offsetMin = cash.rectTransform.offsetMax = Vector2.zero;
            var panels = new GameObject[BalanceCatalog.Businesses.Length];
            var facilityPanel = Panel(canvas.transform, "시설", new Vector2(.02f, .11f), new Vector2(.98f, .88f));
            facilityPanel.SetActive(false);
            for (var i = 0; i < BalanceCatalog.Businesses.Length; i++)
            {
                var def = BalanceCatalog.Businesses[i];
                var tabMin = .02f + i * .195f;
                var tab = Button(canvas.transform, def.Name, new Vector2(tabMin, .03f), new Vector2(tabMin + .18f, .085f));
                var panel = Panel(canvas.transform, $"{def.Name} 12개 유닛", new Vector2(.02f, .11f), new Vector2(.98f, .88f));
                panels[i] = panel;
                panel.SetActive(i == 0);
                var selected = i;
                tab.onClick.AddListener(() =>
                {
                    facilityPanel.SetActive(false);
                    for (var p = 0; p < panels.Length; p++) if (panels[p]) panels[p].SetActive(p == selected);
                });

                for (var unitIndex = 0; unitIndex < 12; unitIndex++)
                {
                    var rowTop = .96f - unitIndex * .079f;
                    var rowBottom = rowTop - .068f;
                    var label = Label(panel.transform, $"Unit {unitIndex + 1}", 27, TextAnchor.MiddleLeft);
                    label.text = $"{unitIndex + 1}번 유닛";
                    SetRect(label.rectTransform, new Vector2(.02f, rowBottom), new Vector2(.28f, rowTop));
                    var tap = Button(panel.transform, "가동", new Vector2(.29f, rowBottom), new Vector2(.50f, rowTop));
                    var buy = Button(panel.transform, "레벨업", new Vector2(.51f, rowBottom), new Vector2(.74f, rowTop));
                    var hire = Button(panel.transform, "매니저", new Vector2(.75f, rowBottom), new Vector2(.98f, rowTop));
                    var id = def.Id;
                    var index = unitIndex;
                    tap.onClick.AddListener(() => game.Tap(id, index));
                    buy.onClick.AddListener(() => game.Buy(id, index));
                    hire.onClick.AddListener(() => game.Hire(id, index));
                }
            }
            for (var i = 0; i < BalanceCatalog.Facilities.Length; i++)
            {
                var def = BalanceCatalog.Facilities[i];
                var top = .95f - i * .102f;
                var bottom = top - .085f;
                var label = Label(facilityPanel.transform, def.Name, 30, TextAnchor.MiddleLeft);
                SetRect(label.rectTransform, new Vector2(.04f, bottom), new Vector2(.55f, top));
                var buy = Button(facilityPanel.transform, "건설/강화", new Vector2(.58f, bottom), new Vector2(.96f, top));
                var id = def.Id;
                buy.onClick.AddListener(() => game.BuyFacility(id));
            }
            var facilitiesTab = Button(canvas.transform, "시설", new Vector2(.02f, .885f), new Vector2(.30f, .925f));
            facilitiesTab.onClick.AddListener(() =>
            {
                for (var p = 0; p < panels.Length; p++) if (panels[p]) panels[p].SetActive(false);
                facilityPanel.SetActive(true);
            });
            var eraButton = Button(canvas.transform, "문명 전환", new Vector2(.70f, .885f), new Vector2(.98f, .925f));
            eraButton.onClick.AddListener(game.AdvanceEra);
            game.Changed += () =>
            {
                cash.text = $"{game.Eras.CurrentName(game.State)} · 도시 Lv.{game.State.cityLevel} · 자금 {Format(game.State.cash)}";
                eraButton.interactable = game.Eras.CanAdvance(game.State);
            };
        }

        private static Text Label(Transform parent, string name, int size, TextAnchor alignment)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var text = go.GetComponent<Text>();
            text.font = uiFont; text.fontSize = size; text.alignment = alignment; text.color = Color.white;
            return text;
        }

        private static Button Button(Transform parent, string title, Vector2 min, Vector2 max)
        {
            var go = new GameObject(title, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            var rect = go.GetComponent<RectTransform>(); rect.anchorMin = min; rect.anchorMax = max;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            go.GetComponent<Image>().color = new Color32(36, 133, 91, 245);
            var label = Label(go.transform, "Label", 34, TextAnchor.MiddleCenter);
            label.text = title; label.rectTransform.anchorMin = Vector2.zero; label.rectTransform.anchorMax = Vector2.one;
            label.rectTransform.offsetMin = label.rectTransform.offsetMax = Vector2.zero;
            return go.GetComponent<Button>();
        }

        private static GameObject Panel(Transform parent, string name, Vector2 min, Vector2 max)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            SetRect(go.GetComponent<RectTransform>(), min, max);
            go.GetComponent<Image>().color = new Color32(17, 28, 44, 225);
            return go;
        }

        private static void SetRect(RectTransform rect, Vector2 min, Vector2 max)
        {
            rect.anchorMin = min; rect.anchorMax = max;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
        }

        private static string Format(double value) => value < 1000 ? value.ToString("N0") : value.ToString("0.##e0");
    }

    public sealed class CitizenMover : MonoBehaviour
    {
        public float phase;
        public int lane;
        private void Update()
        {
            var x = Mathf.Repeat(Time.time * .55f + phase, 9f) - 4.5f;
            transform.position = new Vector3(x, lane * .55f - .2f + Mathf.Sin(Time.time * 5 + phase) * .04f, -1);
        }
    }

    public sealed class AliveCityView : MonoBehaviour
    {
        private void Update()
        {
            var camera = GetComponent<Camera>();
            camera.backgroundColor = Color.Lerp(new Color32(191, 217, 168, 255), new Color32(35, 52, 86, 255),
                Mathf.Clamp01((Mathf.Sin(Time.time * .03f) + 1) * .5f));
        }
    }
}
