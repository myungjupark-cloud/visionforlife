# VisionforLife 프로젝트 현황

**갱신:** 2026-07-08

## 개요

VisionforLife — 여정형 마이크로-LMS.

## 로컬 실행

```bat
cd C:\Projects\visionforlife
copy config.example.json config.local.json
serve.bat
```

- PC: http://localhost:8780/

## 첫 과정

| slug | 제목 |
|------|------|
| `who-is-god` | 하나님은 누구신가? |

## 완료 (v0.2)

- [x] 다과정 카탈로그 홈 (`/api/courses`, `#catalog`)
- [x] 학습 진도 API (`GET/POST /api/progress`)
- [x] 진도 UI (카탈로그 %, 과정 내 진도 바, 「이해했습니다」)
- [x] 로그인 시 서버 동기화 + 비로그인 localStorage
- [x] GitHub 원격 (push 후 URL 확인)

## 다음 작업

1. 과정 추가 UI·2번째 샘플 과정
2. 학습 목표 필드·이어하기 강화
3. 운영자 회원 목록
