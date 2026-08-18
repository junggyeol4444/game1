# Android / iOS 빌드

웹 코어를 Capacitor로 감싸 스토어에 올린다. 게임 로직은 그대로 두고 광고·결제·저장만 네이티브로 바꾼다.

## 1. Capacitor 설치

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init      # capacitor.config.ts 가 이미 있으므로 값만 확인
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode (macOS 필요)
```

`capacitor.config.ts` 의 `appId` 를 실제 패키지명으로 바꾼다 (`com.example.cityidle` → 본인 도메인 역순).

## 2. 광고 연동

```bash
npm i @capacitor-community/admob
```

`src/main.ts` 에서 광고 제공자를 교체한다:

```ts
import { AdMobProvider } from './native/ads-admob';

const admob = new AdMobProvider({
  rewarded: 'ca-app-pub-XXXXXXXX/YYYYYYYY',
});
const ok = await admob.init();
if (ok) {
  game.ads.setProvider(admob);
  for (const p of ['dailyDouble', 'tabBoost', 'trialManager', 'cashDrop', 'prestigeBonus'] as const) {
    void admob.preload(p);
  }
}
```

`src/native/ads-admob.ts` 는 이미 작성되어 있고 `AdProvider` 인터페이스만 구현한다.
게임 쪽 코드는 한 줄도 바뀌지 않는다.

**미디에이션**: AdMob 콘솔에서 AppLovin / Unity Ads / Meta 어댑터를 붙인다.
안드로이드 광고 수익화 점유율이 AdMob 28% / AppLovin 24% 이므로 둘 중 하나를 메인 미디에이터로 두고 나머지를 네트워크로 넣는 구성이 무난하다.

**필수 체크**
- Android 13+ : `POST_NOTIFICATIONS` 권한, `AD_ID` 권한 선언
- iOS 14.5+ : ATT(App Tracking Transparency) 동의 팝업 — `@capacitor-community/admob` 의 `requestTrackingAuthorization()`
- 광고 ID 수집을 Play Console 데이터 안전 섹션에 신고
- 아동 대상 아님으로 분류 (COPPA/GDPR-K 설정)

## 3. 인앱결제 연동

```bash
npm i @revenuecat/purchases-capacitor
```

```ts
import { RevenueCatProvider } from './native/purchases';
const rc = new RevenueCatProvider('appl_XXXX / goog_XXXX');
if (await rc.init()) game.purchases = rc;
```

스토어에 등록할 상품 ID는 `src/core/iap.ts` 의 `sku` 필드 그대로 쓰면 된다:

| sku | 종류 | 가격(원) |
|---|---|---|
| `city_idle_starter_199` | 소비성 (1회) | 2,900 |
| `city_idle_piggy_299` | 소비성 | 4,400 |
| `city_idle_tabboost_499` | 소비성 | 6,900 |
| `city_idle_adfree_999` | 비소비성 | 13,000 |
| `city_idle_redev_1999` | 소비성 | 27,000 |

소비성 상품은 **반드시 영수증 검증**을 거쳐야 한다. RevenueCat을 쓰면 서버 없이 해결된다.

## 4. 저장 / 시간 검증

- 현재 저장은 `localStorage`. Capacitor WebView에서도 동작하지만 **앱 데이터 삭제 시 날아간다.**
  출시 전 `@capacitor/preferences` + 클라우드 백업(Play Games / GameCenter 또는 자체 서버)으로 교체할 것.
- 오프라인 수익은 기기 시간을 쓴다. `src/core/save.ts` 의 `setTimeSource()` 에 서버 시간을 주입하면 시간 조작이 막힌다.

```ts
setTimeSource({ now: () => serverNowMs() });
```

지금은 시간 역행만 감지해 보상을 주지 않고 `state.timeSkew` 에 누적한다.

## 5. 스토어 제출 전 체크리스트

- [ ] 패키지명 / 번들 ID 확정
- [ ] 앱 아이콘 (1024², adaptive icon), 스플래시
- [ ] 스크린샷 6장 (폰) — `tools/smoke.mjs` 로 뽑은 이미지를 그대로 쓸 수 있다
- [ ] 개인정보처리방침 URL (광고 SDK 때문에 필수)
- [ ] 데이터 안전 / App Privacy 설문
- [ ] 연령 등급 설문 (확률형 아이템 없음 → 국내 확률 표시 의무 대상 아님)
- [ ] 클라우드 저장
- [ ] 서버 시간 검증
- [ ] Play Console 에서 **현재 수수료 조건 직접 확인** (30% → 최저 10% 개편 진행 중, 법적 다툼 중)
