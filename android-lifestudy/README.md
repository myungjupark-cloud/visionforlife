# 진리서재 Android APK

진리서재(Web)를 Android 6 (API 23) 이상 태블릿에 설치하기 위한 WebView 래퍼 APK입니다.
(기본 시작 화면: 생명공과 카탈로그)

## 빌드

```powershell
cd C:\Projects\truthlib\android-lifestudy
.\build_apk.ps1
```

성공 시 `TruthLib-release.apk` 가 이 폴더에 생성됩니다.

## 태블릿 설치

1. APK를 태블릿으로 복사 (USB, 이메일, 클라우드 등)
2. **설정 → 보안 · 알 수 없는 출처** 허용 (Android 6)
3. 파일 관리자에서 APK 탭 → 설치

또는 PC에서 ADB:

```bat
adb install -r TruthLib-release.apk
```

## 앱 동작

- 시작 URL: `https://thegospel.kr/truthlib/#catalog/life-study`
- thegospel.kr 도메인 내 링크는 앱 WebView에서 열림
- 뒤로가기: WebView 히스토리 → 앱 종료

## 요구사항

- minSdk **23** (Android 6.0)
- 인터넷 연결 필요 (온라인 PWA)

## 서명

현재 release 빌드도 **debug keystore** 로 서명되어 개인·내부 배포용입니다. Play Store 배포 시 별도 keystore 설정이 필요합니다.
