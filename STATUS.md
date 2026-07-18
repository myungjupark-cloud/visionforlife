# 진리서재 프로젝트 현황

**갱신:** 2026-07-09

## 개요

진리서재 — 여정형 마이크로-LMS.

## 로컬 실행

```bat
cd C:\Projects\truthlib
copy config.example.json config.local.json
serve.bat
```

- PC: http://localhost:8780/

## 공개 카탈로그

| slug | 제목 | published |
|------|------|-----------|
| `life-study` | 생명공부 | true |
| `genesis` | 창세기 관련 | false (운영 작업 중) |
| `human` | 인간에 대한 진리 | false (운영 작업 중) |

## 완료 (v0.4)

- [x] 회원 **등록** 용어 통일 (가입 → 등록)
- [x] 등록 후 승인 대기 (`pending`) — 승인 전 로그인 불가
- [x] 메인 운영자(PIN) / 운영자(`role=operator`) 분리
- [x] 운영자: 승인·강퇴·진도 확인·안내 멘트
- [x] 메인 운영자: 운영자 임명/해제 + 콘텐츠 편집
- [x] 로그인 시 「운영자 안내」 팝업
- [x] 회원 30분 유휴 자동 로그아웃

## 완료 (v0.3)

- [x] 과정 추가 UI (`POST /api/courses`, 카탈로그 운영 모드)
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
2. 퀴즈·검색 노드 타입
