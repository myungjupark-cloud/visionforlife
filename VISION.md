# VisionforLife

**여정형 마이크로-LMS** — 사용자의 개별 학습 목표와 진도에 맞춰 소규모 학습 콘텐츠를 제공합니다.

파편화된 지식을 체계적으로 연결하고, 장기적인 역량 향상을 돕는 교육 에듀테크 모델을 지향합니다.

## faith-mindmap과의 관계

| | faith-mindmap | VisionforLife |
|--|---------------|------------|
| 목적 | 믿음 여정 운영·thegospel.kr | 범용 마이크로-LMS 플랫폼 |
| 폴더 | `C:\Projects\faith-mindmap` | `C:\Projects\visionforlife` |
| 유지보수 | **계속** (별도) | 이 저장소 |
| 결제 | — | **없음** |
| 회원 | 운영 PIN만 | **가입·로그인·진도** (구현 중) |

## 핵심 기능 (로드맵)

### Phase 0 — 셋업 (현재)
- [x] 프로젝트 폴더·Git·문서
- [x] faith-mindmap UI 복사·브랜딩 일반화
- [x] 첫 샘플 과정: **하나님은 누구신가?** (`who-is-god`)
- [ ] 회원 DB·인증 API
- [ ] 학습 진도 저장

### Phase 1 — MVP
- 가입·로그인 UI
- 과정 탐색 + 로그인 사용자 진도 동기화
- 운영자: 과정·노드 편집

### Phase 2 — 개인화
- 학습 목표 설정
- 이어하기·완료율
- 다과정 카탈로그

### Phase 3 — 확장
- cross 링크·검색·퀴즈 노드
- 선택적 AI 초안 (과정별 corpus)
- 운영 대시보드

## 첫 샘플 과정

- **slug:** `who-is-god`
- **제목:** 하나님은 누구신가?
- **데이터:** `data/courses/who-is-god/mindmap.json`

## 기술 스택 (초기)

- PWA: `index.html`, `app.js`, `app.css`, `sw.js`
- API: `api.py` (Python stdlib HTTP + SQLite)
- 콘텐츠: JSON (nodes + edges), 마크다운 설명
