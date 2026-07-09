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
| `who-is-jesus` | 예수님은 누구신가? |

## 완료 (v0.3)

- [x] 과정 추가 UI (`POST /api/courses`, 카탈로그 운영 모드)
- [x] 두 번째 샘플 과정 `who-is-jesus`
- [x] 학습 목표 필드 (`POST /api/auth/goals`, 카탈로그)
- [x] 이어하기 배너·진행 중 과정 우선 정렬
- [x] 운영자 회원 목록 (`GET /api/admin/users`)

## 완료 (v0.2)

- [x] 다과정 카탈로그 홈 (`/api/courses`, `#catalog`)
- [x] 학습 진도 API (`GET/POST /api/progress`)
- [x] 진도 UI (카탈로그 %, 과정 내 진도 바, 「이해했습니다」)
- [x] 로그인 시 서버 동기화 + 비로그인 localStorage
- [x] GitHub 원격 (push 후 URL 확인)

## 다음 작업

1. 과정별 노드 편집 후 카탈로그 메타 동기화
2. 운영자 역할(role) 구분·대시보드
3. 퀴즈·검색 노드 타입
