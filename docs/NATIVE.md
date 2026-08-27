# Android / iOS 빌드

웹 코어를 Capacitor로 감싸 스토어에 올린다. 게임 로직과 로컬 저장은 그대로 두고 광고·결제만 네이티브로 바꾼다.

## 1. Capacitor

의존성과 `capacitor.config.ts` 는 이미 저장소에 있다. **네이티브 프로젝트(`android/`, `ios/`)는
커밋하지 않는다** — 전부 생성물이고 명령 한 줄로 다시 만들어진다. `.gitignore` 에 들어 있다.

```bash
npm run android:open     # build + cap sync + Android Studio 열기
npm run android:sync     # build + cap sync 만 (스튜디오가 이미 열려 있을 때)
```

처음 받은 저장소라 `android/` 가 없으면 한 번만:

```bash
npm i
npx cap add android
npx cap add ios          # macOS + Xcode 필요
```

`capacitor.config.ts` 의 `appId` 를 실제 패키지명으로 바꾼다
(`com.example.cityidle` → 본인 도메인 역순). 스토어 등록 후에는 못 바꾸니 먼저 정할 것.

### APK 는 이 저장소를 만든 컨테이너에서 못 뽑는다

Gradle 과 JDK 는 있지만 **Android SDK 가 없다** (`ANDROID_HOME` 미설정).
`npx cap add android` 로 Gradle 프로젝트를 만드는 데까지는 되고, 실제 빌드는
Android Studio 가 있는 로컬에서 해야 한다. 밸런스 수치가 전부 시뮬레이터 값이라
**첫 실기기 세션 측정이 남은 작업 2번**이다.

## 2. 광고 연동

SDK는 저장소 의존성에 포함되어 있다. 네이티브 빌드 전에 실제 보상형 광고 단위를 주입한다:

```ts
VITE_ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXX/YYYYYYYY npm run android:sync
```

`src/native/bootstrap.ts` 가 네이티브 플랫폼을 감지해 광고를 초기화하고 전 배치를 미리 로드한다.

**미디에이션**: AdMob 콘솔에서 AppLovin / Unity Ads / Meta 어댑터를 붙인다.
안드로이드 광고 수익화 점유율이 AdMob 28% / AppLovin 24% 이므로 둘 중 하나를 메인 미디에이터로 두고 나머지를 네트워크로 넣는 구성이 무난하다.

**필수 체크**
- Android 13+ : `POST_NOTIFICATIONS` 권한, `AD_ID` 권한 선언
- iOS 14.5+ : ATT(App Tracking Transparency) 동의 팝업 — `@capacitor-community/admob` 의 `requestTrackingAuthorization()`
- 광고 ID 수집을 Play Console 데이터 안전 섹션에 신고
- 아동 대상 아님으로 분류 (COPPA/GDPR-K 설정)

## 3. 인앱결제 연동

```bash
VITE_REVENUECAT_ANDROID_KEY=goog_XXXX npm run android:sync
# iOS: VITE_REVENUECAT_IOS_KEY=appl_XXXX npm run build && npx cap sync ios
```

구독은 사용하지 않는다. RevenueCat은 일회성 상품 조회·결제·영수증 검증과 광고 제거 영구
상품 복원에만 사용한다. 소비성 팩은 복원 시 중복 지급하지 않는다.

스토어에 등록할 상품 ID는 `src/core/iap.ts` 의 `sku` 필드 그대로 쓰면 된다:

| sku | 종류 | 가격(원) |
|---|---|---|
| `city_idle_starter_199` | 소비성 (1회) | 2,900 |
| `city_idle_piggy_299` | 소비성 | 4,400 |
| `city_idle_tabboost_499` | 소비성 | 6,900 |
| `city_idle_adfree_999` | 비소비성 | 13,000 |
| `city_idle_redev_1999` | 소비성 | 27,000 |

소비성 상품은 **반드시 영수증 검증**을 거쳐야 한다. RevenueCat을 쓰면 서버 없이 해결된다.

## 4. 로컬 저장 / 시간

- 저장은 의도적으로 `localStorage`만 사용한다. 앱 데이터 삭제나 기기 교체 시 자동 복원하지 않는다.
- 설정의 세이브 내보내기/가져오기로 사용자가 직접 백업할 수 있다.
- 오프라인 수익은 기기 시간을 사용한다. 시간이 역행한 구간에는 보상을 지급하지 않고
  `state.timeSkew`에 기록한다. 서버 시간과 클라우드 저장은 도입하지 않는다.

## 5. 스토어 제출 전 체크리스트

- [ ] 패키지명 / 번들 ID 확정
- [ ] 앱 아이콘 (1024², adaptive icon), 스플래시
- [ ] 스크린샷 6장 (폰) — `tools/smoke.mjs` 로 뽑은 이미지를 그대로 쓸 수 있다
- [ ] 개인정보처리방침 URL (광고 SDK 때문에 필수)
- [ ] 데이터 안전 / App Privacy 설문
- [ ] 연령 등급 설문 (확률형 아이템 없음 → 국내 확률 표시 의무 대상 아님)
- [ ] Play Console 에서 **현재 수수료 조건 직접 확인** (30% → 최저 10% 개편 진행 중, 법적 다툼 중)
