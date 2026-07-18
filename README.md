# 진리서재

개인화 **여정형 마이크로-LMS** PWA.

학습자는 단계별 여정을 따라가고, 운영자는 과정·노드를 설계합니다.  
상세 비전은 [VISION.md](VISION.md), 진행 상황은 [STATUS.md](STATUS.md)를 참고하세요.

## 로컬 실행

```bat
serve.bat
```

기본 포트 **8780** (`faith-mindmap` 8770과 병행 가능).

## 폴더 구조

```
truthlib/
├── index.html, app.js, app.css   # PWA UI
├── api.py, auth_store.py         # API·회원 (구현 중)
├── data/
│   ├── truthlib.db             # 회원·진도 (생성 예정)
│   └── courses/
│       └── who-is-god/
│           └── mindmap.json      # 첫 샘플 과정
├── VISION.md
└── STATUS.md
```

## 데이터 스키마 (과정 JSON)

faith-mindmap과 호환. `nodes[]` + `edges[]`, `rootId`, `meta`.

| 필드 | 설명 |
|------|------|
| `nodes[].title` | 주제·질문 |
| `nodes[].description` | 설명 (마크다운) |
| `nodes[].scripture` | 인용·출처 (향후 `citation`으로 일반화) |

## 관련 프로젝트

- [faith-mindmap](https://github.com/myungjupark-cloud/faith-mindmap) — 믿음 여정 (별도 유지보수)
